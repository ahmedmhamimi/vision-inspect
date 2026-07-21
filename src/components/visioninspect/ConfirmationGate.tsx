/**
 * ConfirmationGate.tsx
 * The mandatory human-confirmation gate. This is the ONLY component in the codebase that
 * calls onConfirm — no other code path in the UI is wired to trigger a PATCH request, and
 * PATCH is the only way human_decision changes on the server (see route.ts and
 * applyHumanDecision() in tool-rules.ts). Visually placed below the tag-perforation
 * divider, so the AI's proposal and the human's sign-off read as two distinct zones of
 * the same tag, never blended together.
 *
 * - ConfirmationGate: renders Confirm / Correct actions. A "Correct" choice reveals a
 *   required note field and lets the reviewer override severity and recommended action
 *   before submitting — silent corrections are not allowed (also enforced server-side in
 *   applyHumanDecision).
 */
'use client';

import { useState } from 'react';
import type {
  ConfirmRequest,
  InspectionRecord,
  RecommendedAction,
  Severity,
} from '@/lib/visioninspect/schema';
import { RECOMMENDED_ACTIONS, SEVERITY_LEVELS } from '@/lib/visioninspect/schema';

interface ConfirmationGateProps {
  record: InspectionRecord;
  onConfirm: (decision: ConfirmRequest) => void;
  disabled?: boolean;
}

export function ConfirmationGate({ record, onConfirm, disabled = false }: ConfirmationGateProps) {
  const [mode, setMode] = useState<'choosing' | 'correcting'>('choosing');
  const [correctedSeverity, setCorrectedSeverity] = useState<Severity>(record.severity);
  const [correctedAction, setCorrectedAction] = useState<RecommendedAction>(
    record.recommended_action,
  );
  const [reviewerNote, setReviewerNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  if (record.human_decision !== 'pending') {
    const isConfirmed = record.human_decision === 'confirmed';
    return (
      <div className="p-5 sm:p-6">
        <span className={isConfirmed ? 'stamp-confirmed' : 'stamp-corrected'}>
          {isConfirmed ? 'Confirmed' : 'Corrected'}
        </span>
        {record.reviewer_note && (
          <p className="mt-3 font-body text-sm text-graphite-soft">
            Reviewer note: {record.reviewer_note}
          </p>
        )}
        {record.confirmed_at && (
          <p className="mt-1 font-mono text-xs text-graphite-soft">
            {new Date(record.confirmed_at).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  const handleConfirm = () => {
    onConfirm({ image_id: record.image_id, decision: 'confirmed' });
  };

  const handleSubmitCorrection = () => {
    if (reviewerNote.trim().length === 0) {
      setNoteError('Please explain what you changed and why before submitting a correction.');
      return;
    }
    setNoteError(null);
    onConfirm({
      image_id: record.image_id,
      decision: 'corrected',
      corrected_severity: correctedSeverity,
      corrected_recommended_action: correctedAction,
      reviewer_note: reviewerNote.trim(),
    });
  };

  return (
    <div className="p-5 sm:p-6">
      <h4 className="font-display text-sm font-medium uppercase tracking-wide text-graphite-soft">
        Reviewer sign-off required
      </h4>
      <p className="mt-1 font-body text-sm text-graphite">
        No inspection status is final until you confirm or correct this finding.
      </p>

      {mode === 'choosing' ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className="touch-target flex-1 rounded-tag bg-teal px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirm finding
          </button>
          <button
            type="button"
            onClick={() => setMode('correcting')}
            disabled={disabled}
            className="touch-target flex-1 rounded-tag border border-severity-medium px-4 py-2 font-body text-sm font-medium text-severity-medium transition-colors hover:bg-severity-medium-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            Correct finding
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-body text-xs uppercase tracking-wide text-graphite-soft">
                Corrected severity
              </span>
              <select
                value={correctedSeverity}
                onChange={(e) => setCorrectedSeverity(e.target.value as Severity)}
                className="mt-1 w-full rounded-tag border border-steel-dark bg-white px-3 py-2 font-body text-sm text-graphite"
              >
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-body text-xs uppercase tracking-wide text-graphite-soft">
                Corrected action
              </span>
              <select
                value={correctedAction}
                onChange={(e) => setCorrectedAction(e.target.value as RecommendedAction)}
                className="mt-1 w-full rounded-tag border border-steel-dark bg-white px-3 py-2 font-body text-sm text-graphite"
              >
                {RECOMMENDED_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="font-body text-xs uppercase tracking-wide text-graphite-soft">
              Why are you correcting this finding? <span aria-hidden="true">*</span>
              <span className="sr-only">required</span>
            </span>
            <textarea
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              rows={3}
              required
              aria-required="true"
              aria-invalid={noteError ? 'true' : undefined}
              aria-describedby={noteError ? 'reviewer-note-error' : undefined}
              className="mt-1 w-full rounded-tag border border-steel-dark bg-white px-3 py-2 font-body text-sm text-graphite"
              placeholder="e.g. The scratch extends across the functional surface, not just cosmetic — raising to high severity."
            />
            {noteError && (
              <p id="reviewer-note-error" role="alert" className="mt-1 font-body text-sm text-severity-high">
                {noteError}
              </p>
            )}
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmitCorrection}
              disabled={disabled}
              className="touch-target flex-1 rounded-tag bg-severity-medium px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit correction
            </button>
            <button
              type="button"
              onClick={() => setMode('choosing')}
              disabled={disabled}
              className="touch-target rounded-tag border border-steel-dark px-4 py-2 font-body text-sm font-medium text-graphite-soft transition-colors hover:bg-porcelain-dim"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
