/**
 * supabase-storage.adapter.ts
 * Implements ReportSinkPort against Supabase Postgres tables `inspection_records` and
 * `inspection_reports` (see supabase-schema.sql). Replaces report-storage.adapter.ts for
 * any deployment where the filesystem is not writable/persistent — i.e. Vercel.
 *
 * Uses the service_role key, so this file must never be imported by client code and
 * SUPABASE_SERVICE_ROLE_KEY must never be exposed with a NEXT_PUBLIC_ prefix. Enforced in
 * practice by the ports/adapters boundary: only composition-root.ts (server-only) ever
 * constructs this class.
 *
 * - SupabaseStorageAdapter: implements ReportSinkPort against Supabase.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InspectionRecord, InspectionReport } from '../schema';
import type { ReportSinkPort } from '../ports/report-sink.port';

interface InspectionRecordRow {
  image_id: string;
  defect_type: InspectionRecord['defect_type'];
  visible_evidence: string;
  location: string;
  severity: InspectionRecord['severity'];
  confidence: number;
  recommended_action: InspectionRecord['recommended_action'];
  human_decision: InspectionRecord['human_decision'];
  notes: string;
  taxonomy_reference: string;
  degraded: boolean;
  degraded_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  reviewer_note: string | null;
  // Postgres bytea. PostgREST serializes bytea as a Postgres hex-encoded string, e.g.
  // "\x89504e470d0a1a0a...", both on the way in (what we must send) and on the way out
  // (what we get back) — see imageToBytea()/byteaToImage() below. Absent from the
  // lightweight columns list() selects, present only when a single record is fetched.
  image_data?: string | null;
  mime_type: InspectionRecord['mime_type'] | null;
  // The auth.users id of the reviewer who ran this inspection. Nullable — see
  // migrations/002_add_authentication.sql and the created_by comment in schema.ts.
  created_by?: string | null;
}

/** Column list used for history/list views: everything except the image payload itself,
 *  so listing 50 records doesn't pull potentially megabytes of image data over the wire
 *  just to render a summary row. The "Info" button fetches the full record (including
 *  the image) on demand via getRecord(). */
const SUMMARY_COLUMNS =
  'image_id, defect_type, visible_evidence, location, severity, confidence, ' +
  'recommended_action, human_decision, notes, taxonomy_reference, degraded, ' +
  'degraded_reason, created_at, confirmed_at, reviewer_note, mime_type, created_by';

/** Converts a base64 image string into the Postgres hex-bytea text format PostgREST
 *  expects for bytea columns on insert (a string beginning with "\x"). */
function imageToBytea(imageBase64: string | undefined): string | null {
  if (!imageBase64) return null;
  return '\\x' + Buffer.from(imageBase64, 'base64').toString('hex');
}

/** Reverses imageToBytea(): converts the hex-bytea text PostgREST returns for a bytea
 *  column back into the base64 string the rest of the app works with. */
function byteaToImage(bytea: string | null | undefined): string | undefined {
  if (!bytea) return undefined;
  const hex = bytea.startsWith('\\x') ? bytea.slice(2) : bytea;
  return Buffer.from(hex, 'hex').toString('base64');
}

interface InspectionReportRow {
  report_id: string;
  image_id: string;
  generated_at: string;
  summary: string;
  ai_hypothesis: InspectionReport['ai_hypothesis'];
  deterministic_routing: InspectionReport['deterministic_routing'];
  human_sign_off: InspectionReport['human_sign_off'];
}

export class SupabaseStorageAdapter implements ReportSinkPort {
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'SupabaseStorageAdapter requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.'
      );
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async saveRecord(record: InspectionRecord): Promise<void> {
    const row: InspectionRecordRow = {
      image_id: record.image_id,
      defect_type: record.defect_type,
      visible_evidence: record.visible_evidence,
      location: record.location,
      severity: record.severity,
      confidence: record.confidence,
      recommended_action: record.recommended_action,
      human_decision: record.human_decision,
      notes: record.notes,
      taxonomy_reference: record.taxonomy_reference,
      degraded: record.degraded,
      degraded_reason: record.degraded_reason ?? null,
      created_at: record.created_at,
      confirmed_at: record.confirmed_at ?? null,
      reviewer_note: record.reviewer_note ?? null,
      image_data: imageToBytea(record.image_base64),
      mime_type: record.mime_type ?? null,
      created_by: record.created_by ?? null,
    };

    const { error } = await this.client
      .from('inspection_records')
      .upsert(row, { onConflict: 'image_id' });

    if (error) throw new Error(`SupabaseStorageAdapter.saveRecord: ${error.message}`);
  }

  /** Fetches a single record WITH its full image payload — used by the "Info" panel in
   *  history, and by anything that needs the complete record, not just a summary row. */
  async getRecord(imageId: string): Promise<InspectionRecord | null> {
    const { data, error } = await this.client
      .from('inspection_records')
      .select('*')
      .eq('image_id', imageId)
      .maybeSingle();

    if (error) throw new Error(`SupabaseStorageAdapter.getRecord: ${error.message}`);
    if (!data) return null;
    return rowToRecord(data as InspectionRecordRow);
  }

  /** Lists summary rows only (no image_data) — see SUMMARY_COLUMNS. Keeps the history
   *  view fast regardless of how many images have accumulated. */
  async listRecords(limit = 50): Promise<InspectionRecord[]> {
    const { data, error } = await this.client
      .from('inspection_records')
      .select(SUMMARY_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseStorageAdapter.listRecords: ${error.message}`);
    return (data ?? []).map((row) => rowToRecord(row as unknown as InspectionRecordRow));
  }

  async saveReport(report: InspectionReport): Promise<void> {
    const row: InspectionReportRow = {
      report_id: report.report_id,
      image_id: report.image_id,
      generated_at: report.generated_at,
      summary: report.summary,
      ai_hypothesis: report.ai_hypothesis,
      deterministic_routing: report.deterministic_routing,
      human_sign_off: report.human_sign_off,
    };

    // Idempotent on report_id per the port contract: on conflict, do nothing rather
    // than throw or duplicate.
    const { error } = await this.client
      .from('inspection_reports')
      .upsert(row, { onConflict: 'report_id', ignoreDuplicates: true });

    if (error) throw new Error(`SupabaseStorageAdapter.saveReport: ${error.message}`);
  }

  async deleteRecord(imageId: string): Promise<void> {
    // inspection_reports.image_id has ON DELETE CASCADE (see fix-cascade-delete.sql),
    // so deleting the record here also deletes its associated report automatically —
    // no separate delete against inspection_reports is needed or correct here.
    const { error: recordError } = await this.client
      .from('inspection_records')
      .delete()
      .eq('image_id', imageId);

    if (recordError) {
      throw new Error(`Failed to delete record from Supabase: ${recordError.message}`);
    }
  }

  async getReportForImage(imageId: string): Promise<InspectionReport | null> {
    const { data, error } = await this.client
      .from('inspection_reports')
      .select('*')
      .eq('image_id', imageId)
      .maybeSingle();

    if (error) throw new Error(`SupabaseStorageAdapter.getReportForImage: ${error.message}`);
    if (!data) return null;

    const row = data as InspectionReportRow;
    return {
      report_id: row.report_id,
      image_id: row.image_id,
      generated_at: new Date(row.generated_at).toISOString(),
      summary: row.summary,
      ai_hypothesis: row.ai_hypothesis,
      deterministic_routing: row.deterministic_routing,
      human_sign_off: row.human_sign_off,
    };
  }
}

function rowToRecord(row: InspectionRecordRow): InspectionRecord {
  return {
    image_id: row.image_id,
    defect_type: row.defect_type,
    visible_evidence: row.visible_evidence,
    location: row.location,
    severity: row.severity,
    confidence: row.confidence,
    recommended_action: row.recommended_action,
    human_decision: row.human_decision,
    notes: row.notes,
    taxonomy_reference: row.taxonomy_reference,
    degraded: row.degraded,
    degraded_reason: row.degraded_reason ?? undefined,
    // Postgres timestamptz round-trips through supabase-js as e.g.
    // "2026-07-25T11:14:19.123456+00:00", but InspectionRecordSchema's
    // z.string().datetime() strictly requires the "...Z" suffix form. Normalize on
    // the way out so every record read back from Supabase re-validates cleanly.
    created_at: new Date(row.created_at).toISOString(),
    confirmed_at: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
    reviewer_note: row.reviewer_note ?? undefined,
    image_base64: byteaToImage(row.image_data),
    mime_type: row.mime_type ?? undefined,
    created_by: row.created_by ?? undefined,
  };
}