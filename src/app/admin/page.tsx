/**
 * page.tsx (/admin)
 * The admin dashboard: aggregate stats across every inspection, plus a table of every
 * record. A Server Component that calls listInspectionHistory() directly — no separate
 * /api/admin route needed, since this page only ever runs server-side and the admin-role
 * check already happened in the layout above it (see app/admin/layout.tsx).
 *
 * Deliberately reads a larger page (500) than the reviewer-facing history view (50, see
 * HistoryList.tsx) — this page's job is "view everything", not a quick recent-activity
 * glance.
 */
import Link from 'next/link';
import { listInspectionHistory } from '@/lib/visioninspect/service';
import type { InspectionRecord } from '@/lib/visioninspect/schema';
import { SeverityBadge } from '@/components/visioninspect/EvidencePanel';

export const dynamic = 'force-dynamic';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-steel bg-white p-4 shadow-tag">
      <p className="text-xs uppercase tracking-wide text-graphite-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-graphite">{value}</p>
    </div>
  );
}

function decisionLabel(record: InspectionRecord): string {
  if (record.human_decision === 'pending') return 'Awaiting review';
  if (record.human_decision === 'confirmed') return 'Confirmed';
  return 'Corrected';
}

function computeStats(records: InspectionRecord[]) {
  const total = records.length;
  const pending = records.filter((r) => r.human_decision === 'pending').length;
  const confirmed = records.filter((r) => r.human_decision === 'confirmed').length;
  const corrected = records.filter((r) => r.human_decision === 'corrected').length;
  const high = records.filter((r) => r.severity === 'high').length;
  const degraded = records.filter((r) => r.degraded).length;
  const avgConfidence =
    total === 0 ? 0 : records.reduce((sum, r) => sum + r.confidence, 0) / total;

  return { total, pending, confirmed, corrected, high, degraded, avgConfidence };
}

export default async function AdminDashboardPage() {
  const records = await listInspectionHistory(500);
  const stats = computeStats(records);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-fluid-lg font-medium text-graphite">
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm text-graphite-soft">
          Every inspection recorded by the system, across every reviewer.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total inspections" value={stats.total} />
        <StatCard label="Awaiting review" value={stats.pending} />
        <StatCard label="Confirmed" value={stats.confirmed} />
        <StatCard label="Corrected" value={stats.corrected} />
        <StatCard label="High severity" value={stats.high} />
        <StatCard label="Avg. confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} />
      </div>

      <div className="overflow-hidden rounded-card border border-steel bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-steel bg-porcelain-dim text-xs uppercase tracking-wide text-graphite-soft">
            <tr>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Defect type</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Recommended action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted by</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-graphite-soft">
                  No inspections recorded yet.
                </td>
              </tr>
            )}
            {records.map((record) => (
              <tr key={record.image_id} className="border-b border-steel last:border-0">
                <td className="px-4 py-3 text-graphite-soft">
                  {new Date(record.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-graphite">
                  {record.defect_type.replace(/-/g, ' ')}
                  {record.degraded && (
                    <span className="ml-2 rounded-tag bg-severity-medium-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-severity-medium">
                      Degraded
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={record.severity} />
                </td>
                <td className="px-4 py-3 font-mono text-graphite-soft">
                  {Math.round(record.confidence * 100)}%
                </td>
                <td className="px-4 py-3 text-graphite-soft">
                  {record.recommended_action.replace(/-/g, ' ')}
                </td>
                <td className="px-4 py-3 text-graphite-soft">{decisionLabel(record)}</td>
                <td className="px-4 py-3 font-mono text-xs text-graphite-soft">
                  {record.created_by ? record.created_by.slice(0, 8) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/records/${record.image_id}`}
                    className="text-teal-dark hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
