/**
 * InfoModal.tsx
 * The full detail view behind each history row's "Info" button. Unlike HistoryList's
 * summary row (defect type + severity + decision + date only), this shows the complete
 * inspection: the original image, every AI-stated field, the deterministic routing, and
 * the full human sign-off trail with timestamps.
 *
 * Deliberately fetches its own data via GET /api/visioninspect?image_id=... rather than
 * being handed a record prop, because HistoryList's list view intentionally omits the
 * image payload to stay light (see SupabaseStorageAdapter.listRecords) — the full image
 * only comes down the wire once someone actually asks to see it.
 *
 * - InfoModal: the component. Renders nothing (returns null) until opened.
 */
'use client';

import { useEffect, useState } from 'react';
import type { InspectionRecord } from '@/lib/visioninspect/schema';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { SeverityBadge } from './EvidencePanel';

interface InfoModalProps {
  imageId: string;
  onClose: () => void;
}

function decisionDotClass(decision: InspectionRecord['human_decision']): string {
  if (decision === 'pending') return 'bg-amber-500 animate-pulse';
  if (decision === 'confirmed') return 'bg-emerald-500';
  return 'bg-blue-500';
}

function decisionLabel(decision: InspectionRecord['human_decision']): string {
  if (decision === 'pending') return 'Awaiting review';
  if (decision === 'confirmed') return 'Confirmed';
  return 'Corrected';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-graphite-soft">{label}</dt>
      <dd className="mt-0.5 font-body text-sm text-graphite">{children}</dd>
    </div>
  );
}

export function InfoModal({ imageId, onClose }: InfoModalProps) {
  const [record, setRecord] = useState<InspectionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setError(null);

    fetch(`/api/visioninspect?image_id=${imageId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not load this inspection.');
        return body.record as InspectionRecord;
      })
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this inspection.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inspection details"
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-graphite/50 p-4 py-8 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in-up w-full max-w-lg rounded-card bg-white/95 hover:-translate-y-0 hover:shadow-tag"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-fluid-lg font-medium tracking-tight text-graphite">
              Inspection details
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full border border-steel/80 px-3 py-1 font-body text-sm font-medium text-graphite-soft transition-colors hover:bg-porcelain-dim"
            >
              Close
            </button>
          </div>

          {error && (
            <div className="mt-4">
              <ErrorState message={error} />
            </div>
          )}

          {!record && !error && (
            <div className="mt-4">
              <LoadingState label="Loading inspection details…" />
            </div>
          )}

          {record && (
            <div className="mt-4 space-y-4">
              {record.image_base64 && record.mime_type ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${record.mime_type};base64,${record.image_base64}`}
                  alt={`Inspection image for ${record.defect_type.replace(/-/g, ' ')}`}
                  className="w-full rounded-xl border border-steel/80 object-contain shadow-sm"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-steel-dark bg-porcelain-dim px-3 py-4 text-center font-body text-xs text-graphite-soft">
                  No image on file for this inspection.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={record.severity} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-steel/50 bg-porcelain-dim px-2.5 py-1 font-body text-xs font-medium text-graphite-soft">
                  <span className={`h-1.5 w-1.5 rounded-full ${decisionDotClass(record.human_decision)}`} />
                  {decisionLabel(record.human_decision)}
                </span>
                <span className="font-mono text-xs text-graphite-soft/80">{record.image_id}</span>
              </div>

              <h4 className="font-display text-base font-semibold capitalize tracking-tight text-graphite">
                {record.defect_type.replace(/-/g, ' ')}
              </h4>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Visible evidence (AI-stated)">{record.visible_evidence}</Field>
                <Field label="Location">{record.location}</Field>
                <Field label="Confidence">{Math.round(record.confidence * 100)}%</Field>
                <Field label="Recommended action">
                  {record.recommended_action.replace(/-/g, ' ')}
                </Field>
                <Field label="Taxonomy reference">{record.taxonomy_reference}</Field>
                <Field label="Human decision">{decisionLabel(record.human_decision)}</Field>
                {record.notes && <Field label="Additional notes">{record.notes}</Field>}
                {record.reviewer_note && (
                  <Field label="Reviewer note">{record.reviewer_note}</Field>
                )}
                {record.degraded && (
                  <Field label="Degraded fallback">
                    {record.degraded_reason ?? 'Produced by a degraded-confidence fallback provider.'}
                  </Field>
                )}
                <Field label="Created at">{new Date(record.created_at).toLocaleString()}</Field>
                {record.confirmed_at && (
                  <Field label="Confirmed/corrected at">
                    {new Date(record.confirmed_at).toLocaleString()}
                  </Field>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
