/**
 * in-memory-report-sink.ts
 * A test-only ReportSinkPort implementation backed by plain in-memory Maps. Used by
 * tests/api/visioninspect.test.ts via composition-root's __setCompositionForTests so API
 * tests never touch the real filesystem-backed ReportStorageAdapter.
 */
import type { InspectionRecord, InspectionReport } from '@/lib/visioninspect/schema';
import type { ReportSinkPort } from '@/lib/visioninspect/ports/report-sink.port';

export class InMemoryReportSink implements ReportSinkPort {
  private records = new Map<string, InspectionRecord>();
  private reports = new Map<string, InspectionReport>();

  async saveRecord(record: InspectionRecord): Promise<void> {
    this.records.set(record.image_id, record);
  }

  async getRecord(imageId: string): Promise<InspectionRecord | null> {
    return this.records.get(imageId) ?? null;
  }

  async listRecords(limit?: number): Promise<InspectionRecord[]> {
    return Array.from(this.records.values())
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit ?? 50);
  }

  async deleteRecord(imageId: string): Promise<void> {
    this.records.delete(imageId);
    // Find and delete the report if it exists
    const reportEntry = Array.from(this.reports.entries()).find(([_, report]) => report.image_id === imageId);
    if (reportEntry) {
      this.reports.delete(reportEntry[0]);
    }
  }

  async saveReport(report: InspectionReport): Promise<void> {
    this.reports.set(report.report_id, report);
  }

  /** Test-only helper, not part of ReportSinkPort. */
  getSavedReports(): InspectionReport[] {
    return [...this.reports.values()];
  }
}
