/**
 * ResultView.tsx
 * Composes EvidencePanel (AI proposal) and ConfirmationGate (human sign-off) into one
 * evidence tag, visually divided by the perforation line — the two zones never blend
 * into a single undifferentiated card. Once a report has been generated (after
 * confirm/correct), shows a compact report summary beneath the tag.
 */
import type { ConfirmRequest, InspectionRecord, InspectionReport } from '@/lib/visioninspect/schema';
import { EvidencePanel } from './EvidencePanel';
import { ConfirmationGate } from './ConfirmationGate';

interface ResultViewProps {
  record: InspectionRecord;
  report: InspectionReport | null;
  onConfirm: (decision: ConfirmRequest) => void;
  confirming?: boolean;
}

export function ResultView({ record, report, onConfirm, confirming = false }: ResultViewProps) {
  return (
    <div className="space-y-4">
      <div className="evidence-tag">
        <EvidencePanel record={record} />
        <div className="tag-perforation" role="presentation" />
        <ConfirmationGate record={record} onConfirm={onConfirm} disabled={confirming} />
      </div>

      {report && (
        <div className="rounded-tag border border-teal bg-teal/5 p-5 sm:p-6">
          <h4 className="font-display text-sm font-medium uppercase tracking-wide text-teal-dark">
            Inspection report generated
          </h4>
          <p className="mt-2 font-body text-sm text-graphite">{report.summary}</p>
          <p className="mt-3 font-mono text-xs text-graphite-soft">
            Report {report.report_id.slice(0, 8)} · generated{' '}
            {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
