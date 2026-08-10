/**
 * report-sink.port.ts
 * Outbound port: how a confirmed inspection report gets persisted, without the domain
 * layer (which generates the report's *content*) knowing or caring where it ends up.
 *
 * Owned by: Ahmed (Integration Lead / Solution Architect) — deliberately, even though
 * report *generation* is Ali's domain logic. Persistence is an environment/deployment
 * decision (file storage now, a real database later, which storage bucket in production),
 * and keeping that decision with the lead avoids Ali's domain code needing to know
 * about infrastructure choices made in a later session. See docs/architecture.md
 * "Ownership rationale".
 */
import type { InspectionRecord, InspectionReport } from '../schema';

export interface ReportSinkPort {
  /** Persists a generated report. Must be idempotent on report_id — calling this twice
   *  with the same report_id must not create duplicate stored reports. */
  saveReport(report: InspectionReport): Promise<void>;

  /** Persists (or overwrites) the working inspection record — used both right after
   *  routing (human_decision: 'pending') and again after the human-confirmation gate
   *  updates it, so the record's current state can be reloaded across requests. */
  saveRecord(record: InspectionRecord): Promise<void>;

  /** Loads a previously saved working record by image_id, or null if none exists. */
  getRecord(imageId: string): Promise<InspectionRecord | null>;

  /** Lists saved records, most recent first — backs the inspection history view. */
  listRecords(limit?: number): Promise<InspectionRecord[]>;

  /** Deletes a saved record and its associated report. */
  deleteRecord(imageId: string): Promise<void>;

  /** Loads the generated report for a given image, or null if none has been generated
   *  yet (e.g. the record is still pending human confirmation). Backs the admin
   *  dashboard's record-detail view — see app/admin/records/[imageId]/page.tsx. */
  getReportForImage(imageId: string): Promise<InspectionReport | null>;
}
