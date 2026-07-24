import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { InspectionRecord, InspectionReport } from '../schema';
import type { ReportSinkPort } from '../ports/report-sink.port';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../ai/providers';

export class SupabaseStorageAdapter implements ReportSinkPort {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }

  async saveRecord(record: InspectionRecord): Promise<void> {
    const { error } = await this.client
      .from('inspection_records')
      .upsert({
        image_id: record.image_id,
        record: record,
        created_at: record.created_at,
      });

    if (error) {
      throw new Error(`Failed to save record to Supabase: ${error.message}`);
    }
  }

  async getRecord(imageId: string): Promise<InspectionRecord | null> {
    const { data, error } = await this.client
      .from('inspection_records')
      .select('record')
      .eq('image_id', imageId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get record from Supabase: ${error.message}`);
    }

    if (!data) return null;
    return data.record as InspectionRecord;
  }

  async listRecords(limit = 50): Promise<InspectionRecord[]> {
    const { data, error } = await this.client
      .from('inspection_records')
      .select('record')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list records from Supabase: ${error.message}`);
    }

    return (data || []).map((row) => row.record as InspectionRecord);
  }

  async saveReport(report: InspectionReport): Promise<void> {
    const { error } = await this.client
      .from('inspection_reports')
      .insert({
        report_id: report.report_id,
        report: report,
        created_at: report.generated_at,
      });

    if (error) {
      // Ignore unique violation if we try to save the same report again, ensuring idempotence.
      if (error.code === '23505') {
        return;
      }
      throw new Error(`Failed to save report to Supabase: ${error.message}`);
    }
  }
}
