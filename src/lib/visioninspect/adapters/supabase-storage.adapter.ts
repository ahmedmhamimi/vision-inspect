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
    };

    const { error } = await this.client
      .from('inspection_records')
      .upsert(row, { onConflict: 'image_id' });

    if (error) throw new Error(`SupabaseStorageAdapter.saveRecord: ${error.message}`);
  }

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

  async listRecords(limit = 50): Promise<InspectionRecord[]> {
    const { data, error } = await this.client
      .from('inspection_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseStorageAdapter.listRecords: ${error.message}`);
    return (data ?? []).map((row) => rowToRecord(row as InspectionRecordRow));
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
    // Delete from both tables. 
    const { error: recordError } = await this.client
      .from('inspection_records')
      .delete()
      .eq('image_id', imageId);

    if (recordError) {
      throw new Error(`Failed to delete record from Supabase: ${recordError.message}`);
    }

    // In inspection_reports, image_id is inside the JSONB column "report".
    // We use the JSONB ->> operator in Supabase via eq('report->>image_id', imageId).
    const { error: reportError } = await this.client
      .from('inspection_reports')
      .delete()
      .eq('report->>image_id', imageId);

    if (reportError) {
      throw new Error(`Failed to delete report from Supabase: ${reportError.message}`);
    }
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
  };
}