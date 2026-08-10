/**
 * page.tsx (/admin/records/[imageId])
 * Full detail view for a single inspection: the record (including the original image,
 * if one was persisted) and its generated report, if the record has reached
 * confirmed/corrected state. Reads directly through the service layer, same pattern as
 * app/admin/page.tsx.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getReportSink } from '@/lib/visioninspect/composition-root';
import { getInspectionReport } from '@/lib/visioninspect/service';
import { SeverityBadge } from '@/components/visioninspect/EvidencePanel';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-graphite-soft">{label}</p>
      <p className="mt-0.5 text-graphite">{value}</p>
    </div>
  );
}

export default async function AdminRecordDetailPage({
  params,
}: {
  params: { imageId: string };
}) {
  const record = await getReportSink().getRecord(params.imageId);
  if (!record) notFound();

  const report = await getInspectionReport(params.imageId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-teal-dark hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 font-display text-fluid-lg font-medium text-graphite">
          {record.defect_type.replace(/-/g, ' ')}
        </h1>
        <p className="mt-1 font-mono text-xs text-graphite-soft">{record.image_id}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {record.image_base64 && record.mime_type ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${record.mime_type};base64,${record.image_base64}`}
            alt="Inspected item"
            className="w-full rounded-card border border-steel object-cover shadow-tag"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-card border border-dashed border-steel text-sm text-graphite-soft">
            No image on file
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 rounded-card border border-steel bg-white p-5 shadow-card sm:grid-cols-3">
          <Field label="Severity" value={<SeverityBadge severity={record.severity} />} />
          <Field label="Confidence" value={`${Math.round(record.confidence * 100)}%`} />
          <Field
            label="Recommended action"
            value={record.recommended_action.replace(/-/g, ' ')}
          />
          <Field label="Human decision" value={record.human_decision} />
          <Field label="Location" value={record.location} />
          <Field label="Taxonomy reference" value={record.taxonomy_reference} />
          <Field label="Created" value={new Date(record.created_at).toLocaleString()} />
          <Field
            label="Confirmed"
            value={record.confirmed_at ? new Date(record.confirmed_at).toLocaleString() : '—'}
          />
          <Field label="Submitted by" value={record.created_by ?? '—'} />
          <div className="col-span-full">
            <Field label="Visible evidence" value={record.visible_evidence} />
          </div>
          {record.notes && (
            <div className="col-span-full">
              <Field label="AI notes" value={record.notes} />
            </div>
          )}
          {record.reviewer_note && (
            <div className="col-span-full">
              <Field label="Reviewer note" value={record.reviewer_note} />
            </div>
          )}
          {record.degraded && (
            <div className="col-span-full">
              <Field
                label="Degraded analysis"
                value={record.degraded_reason ?? 'No reason recorded.'}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-card border border-steel bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-medium text-graphite">Generated report</h2>
        {report ? (
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <Field label="Summary" value={report.summary} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Report ID" value={<span className="font-mono text-xs">{report.report_id}</span>} />
              <Field label="Generated" value={new Date(report.generated_at).toLocaleString()} />
              <Field label="Sign-off" value={report.human_sign_off.decision} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-graphite-soft">
            No report yet — this inspection hasn&apos;t been confirmed by a reviewer.
          </p>
        )}
      </div>
    </div>
  );
}
