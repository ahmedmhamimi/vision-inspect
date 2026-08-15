/**
 * EvidencePanel.tsx
 * Displays what the AI proposed: defect type, its own stated visible evidence and
 * location, the deterministic severity/taxonomy routing, and a calibrated confidence
 * meter. This is the "AI proposed" half of the evidence tag — everything here comes from
 * routeDefect()'s output and is presented as a claim to be reviewed, not as a verdict.
 *
 * - EvidencePanel: the component itself.
 * - SeverityBadge: exported separately since HistoryList also needs a compact severity
 *   indicator without the full evidence panel.
 */
import type { InspectionRecord, Severity } from '@/lib/visioninspect/schema';
import { UncertaintyBreakdown } from './UncertaintyBreakdown';

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-severity-low-bg', text: 'text-severity-low', label: 'Low severity' },
  medium: { bg: 'bg-severity-medium-bg', text: 'text-severity-medium', label: 'Medium severity' },
  high: { bg: 'bg-severity-high-bg', text: 'text-severity-high', label: 'High severity' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center rounded-tag px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const ticks = [25, 50, 75];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-body text-xs uppercase tracking-wide text-graphite-soft">
          Stated confidence
        </span>
        <span className="font-mono text-sm font-medium text-graphite" aria-hidden="true">
          {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI-stated confidence: ${percent} percent`}
        className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-steel"
      >
        <div
          className="h-full rounded-full bg-teal transition-[width]"
          style={{ width: `${percent}%` }}
        />
        {ticks.map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className="absolute top-0 h-full w-px bg-porcelain/70"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface EvidencePanelProps {
  record: InspectionRecord;
}

export function EvidencePanel({ record }: EvidencePanelProps) {
  return (
    <div className="relative p-5 sm:p-6 space-y-5">
      <div className="tag-punch-hole -left-1.5 -top-1.5" aria-hidden="true" />

      {record.degraded && (
        <div
          role="status"
          className="rounded-tag border border-severity-medium bg-severity-medium-bg px-3 py-2 font-body text-xs text-graphite"
        >
          This hypothesis was produced by a degraded-confidence fallback provider that
          could not fully analyze the image.{' '}
          {record.degraded_reason && <span>{record.degraded_reason}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={record.severity} />
        <span className="font-mono text-xs text-graphite-soft">
          ID {record.image_id.slice(0, 8)}
        </span>
      </div>

      <h3 className="font-display text-fluid-lg font-medium capitalize text-graphite">
        {record.defect_type.replace(/-/g, ' ')}
      </h3>

      <dl className="space-y-3">
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-graphite-soft">
            Visible evidence (AI-stated)
          </dt>
          <dd className="mt-0.5 font-body text-sm text-graphite">{record.visible_evidence}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-graphite-soft">
            Location
          </dt>
          <dd className="mt-0.5 font-body text-sm text-graphite">{record.location}</dd>
        </div>
        {record.notes && (
          <div>
            <dt className="font-body text-xs uppercase tracking-wide text-graphite-soft">
              Additional notes
            </dt>
            <dd className="mt-0.5 font-body text-sm text-graphite">{record.notes}</dd>
          </div>
        )}
      </dl>

      <div>
        <ConfidenceMeter confidence={record.confidence} />
      </div>

      {record.uncertainty_metrics && (
        <div className="mt-4">
          <UncertaintyBreakdown metrics={record.uncertainty_metrics} />
        </div>
      )}

      <div className="flex items-center justify-between rounded-tag bg-porcelain-dim px-3 py-2">
        <span className="font-body text-xs text-graphite-soft">Deterministic routing</span>
        <span className="font-mono text-xs text-graphite">{record.taxonomy_reference}</span>
      </div>
    </div>
  );
}
