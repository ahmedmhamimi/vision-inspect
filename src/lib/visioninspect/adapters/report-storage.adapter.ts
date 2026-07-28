/**
 * report-storage.adapter.ts
 * Implements ReportSinkPort using flat JSON files on disk under REPORT_STORAGE_DIR.
 * Suitable for local development and a small bounded pilot, matching the project brief's
 * actual scope — not a production-scale database. Owned by Ahmed since storage choice is
 * an environment/deployment decision (see report-sink.port.ts for the ownership
 * rationale).
 *
 * ⚠️ VERCEL NOTE: Vercel's serverless filesystem is read-only outside of /tmp, and /tmp
 * is not persistent across invocations. This file-based adapter is correct for local
 * development but will NOT persist data on a real Vercel deployment. Before deploying,
 * swap this adapter for one backed by a real database or object store (e.g. Vercel
 * Postgres, Vercel Blob, or Upstash) — the ReportSinkPort interface is exactly what makes
 * that a one-file change with zero edits to the domain layer or service.ts. This is
 * flagged again in SETUP_AND_NEXT_STEPS.md.
 *
 * - ReportStorageAdapter: implements ReportSinkPort against local JSON files.
 */
import { mkdir, readFile, readdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import type { InspectionRecord, InspectionReport } from '../schema';
import type { ReportSinkPort } from '../ports/report-sink.port';

export class ReportStorageAdapter implements ReportSinkPort {
  private readonly baseDir: string;

  constructor(baseDir: string = process.env.REPORT_STORAGE_DIR ?? '.data/reports') {
    this.baseDir = join(process.cwd(), baseDir);
  }

  private recordsDir(): string {
    return join(this.baseDir, 'records');
  }

  private reportsDir(): string {
    return join(this.baseDir, 'reports');
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.recordsDir(), { recursive: true });
    await mkdir(this.reportsDir(), { recursive: true });
  }

  async saveRecord(record: InspectionRecord): Promise<void> {
    await this.ensureDirs();
    const filePath = join(this.recordsDir(), `${record.image_id}.json`);
    await writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }

  async getRecord(imageId: string): Promise<InspectionRecord | null> {
    await this.ensureDirs();
    const filePath = join(this.recordsDir(), `${imageId}.json`);
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as InspectionRecord;
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  /** Lists summary rows only — image_base64 is stripped out, same as
   *  SupabaseStorageAdapter.listRecords, so the history view stays light regardless of
   *  storage backend. getRecord() still returns the full record, image included. */
  async listRecords(limit = 50): Promise<InspectionRecord[]> {
    await this.ensureDirs();
    const files = await readdir(this.recordsDir());
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const records: InspectionRecord[] = [];
    for (const file of jsonFiles) {
      const raw = await readFile(join(this.recordsDir(), file), 'utf-8');
      const { image_base64: _image_base64, ...summary } = JSON.parse(raw) as InspectionRecord;
      records.push(summary as InspectionRecord);
    }

    return records
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }

  async saveReport(report: InspectionReport): Promise<void> {
    await this.ensureDirs();
    const filePath = join(this.reportsDir(), `${report.report_id}.json`);
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }

  async deleteRecord(imageId: string): Promise<void> {
    await this.ensureDirs();
    
    const recordPath = join(this.recordsDir(), `${imageId}.json`);
    try {
      await unlink(recordPath);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }

    try {
      const files = await readdir(this.reportsDir());
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = join(this.reportsDir(), file);
        try {
          const raw = await readFile(filePath, 'utf-8');
          const report = JSON.parse(raw) as InspectionReport;
          if (report.image_id === imageId) {
            await unlink(filePath);
          }
        } catch (err) {
          // ignore read/parse errors for individual files
        }
      }
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }
  }
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}
