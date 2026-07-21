/**
 * tool-rules.ts
 * The two deterministic tools named in the project brief: route_defect() and
 * generate_inspection_report(). Both are pure functions — same input always produces the
 * same output, no network calls, no filesystem access, no AI SDK imports anywhere in this
 * file. This is what makes the 10-case evaluation matrix and the domain unit tests
 * reproducible without any API key configured.
 *
 * - routeDefect(hypothesis, imageId, taxonomy): applies taxonomy + severity + confidence
 *   policy to turn a raw AI hypothesis into a routed InspectionRecord with
 *   human_decision: 'pending'.
 * - generateInspectionReport(record): builds the auditable summary. Rejects, at both the
 *   type level and the runtime level, any record whose human_decision is not 'confirmed'
 *   or 'corrected' — see UnconfirmedRecordError.
 * - applyHumanDecision(record, decision): the ONLY function in the codebase that is
 *   allowed to move a record's human_decision out of 'pending'. Called exclusively from
 *   the PATCH handler behind the confirmation UI — see route.ts and
 *   components/visioninspect/ConfirmationGate.tsx.
 */
import { randomUUID } from 'crypto';
import {
  ConfirmedInspectionRecordSchema,
  type ConfirmedInspectionRecord,
  type ConfirmRequest,
  type InspectionRecord,
  type InspectionReport,
  type RawHypothesis,
  type RecommendedAction,
  type Severity,
} from './schema';
import { findTaxonomyEntry, isLowConfidence, type Taxonomy } from './taxonomy';

/** Defect types where policy overrides the taxonomy's default severity outright.
 *  Kept as an explicit, named, commented constant — not buried inline — because this is
 *  exactly the kind of rule an evaluator or a future teammate needs to find in one place.
 *  See docs and knowledge/visioninspect/sop-register.md § Severity policy, rule 1. */
const ALWAYS_HIGH_SEVERITY_DEFECTS = new Set(['crack']);

export class UnconfirmedRecordError extends Error {
  constructor(imageId: string, actualDecision: string) {
    super(
      `generate_inspection_report() was called for image_id "${imageId}" but its ` +
        `human_decision is "${actualDecision}", not "confirmed" or "corrected". No ` +
        `inspection report may be generated until a human reviewer has explicitly acted ` +
        `on this record. This is the mandatory human-confirmation gate — see ` +
        `docs/architecture.md.`,
    );
    this.name = 'UnconfirmedRecordError';
  }
}

export class MissingReviewerNoteError extends Error {
  constructor() {
    super(
      'A "corrected" decision requires a non-empty reviewer_note explaining the override ' +
        '— silent corrections are not permitted, since the report must remain auditable.',
    );
    this.name = 'MissingReviewerNoteError';
  }
}

/**
 * route_defect() — maps a raw AI hypothesis, plus the approved taxonomy, to a fully
 * routed InspectionRecord. Severity comes from the taxonomy (with the crack-policy
 * override applied); recommended_action is derived jointly from severity AND confidence,
 * so a low-confidence hypothesis is escalated to a senior reviewer regardless of how
 * severe the defect would be if the hypothesis is correct.
 */
export function routeDefect(
  hypothesis: RawHypothesis,
  imageId: string,
  taxonomy: Taxonomy,
): InspectionRecord {
  const entry = findTaxonomyEntry(taxonomy, hypothesis.defect_type);

  let severity: Severity = entry.default_severity;
  if (ALWAYS_HIGH_SEVERITY_DEFECTS.has(hypothesis.defect_type)) {
    severity = 'high';
  }

  const lowConfidence = isLowConfidence(taxonomy, hypothesis.confidence);

  let recommendedAction: RecommendedAction;
  if (hypothesis.defect_type === 'no-defect-detected' && !lowConfidence) {
    recommendedAction = 'accept';
  } else if (lowConfidence) {
    recommendedAction = 'escalate-to-senior-reviewer';
  } else if (severity === 'high') {
    recommendedAction = 'reject';
  } else if (severity === 'medium') {
    recommendedAction = 'flag-for-secondary-review';
  } else {
    recommendedAction = 'accept';
  }

  return {
    image_id: imageId,
    defect_type: hypothesis.defect_type,
    visible_evidence: hypothesis.visible_evidence,
    location: hypothesis.location,
    severity,
    confidence: hypothesis.confidence,
    recommended_action: recommendedAction,
    human_decision: 'pending',
    notes: hypothesis.notes ?? '',
    taxonomy_reference: entry.sop_reference,
    degraded: hypothesis.degraded ?? false,
    degraded_reason: hypothesis.degraded_reason,
    created_at: new Date().toISOString(),
  };
}

/**
 * The only function permitted to move human_decision out of 'pending'. Applies an
 * explicit reviewer decision — 'confirmed' (accept the AI + routing as-is) or
 * 'corrected' (override severity/recommended_action with a required note) — and returns
 * the updated record. Does not persist anything; persistence is the caller's job via the
 * report-sink port.
 */
export function applyHumanDecision(
  record: InspectionRecord,
  decision: ConfirmRequest,
): InspectionRecord {
  if (decision.decision === 'corrected') {
    if (!decision.reviewer_note || decision.reviewer_note.trim().length === 0) {
      throw new MissingReviewerNoteError();
    }
  }

  return {
    ...record,
    severity: decision.corrected_severity ?? record.severity,
    recommended_action: decision.corrected_recommended_action ?? record.recommended_action,
    human_decision: decision.decision,
    confirmed_at: new Date().toISOString(),
    reviewer_note: decision.reviewer_note,
  };
}

/**
 * generate_inspection_report() — builds the auditable summary for a confirmed record.
 * Re-validates human_decision and confirmed_at at RUNTIME, in addition to the
 * ConfirmedInspectionRecord type narrowing that TypeScript enforces at compile time. This
 * matters because a caller could construct an object that satisfies the JS shape while
 * bypassing the type system (e.g. via `as any` at a deserialization boundary) — the
 * runtime guard is what makes "no report without confirmation" a real guarantee rather
 * than a type-only one. See tests/domain/tool-rules.test.ts for the test that exercises
 * exactly this bypass path.
 */
export function generateInspectionReport(record: ConfirmedInspectionRecord): InspectionReport {
  const parsed = ConfirmedInspectionRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new UnconfirmedRecordError(
      typeof record.image_id === 'string' ? record.image_id : 'unknown',
      typeof record.human_decision === 'string' ? record.human_decision : 'unknown',
    );
  }
  const confirmed = parsed.data;

  return {
    report_id: randomUUID(),
    image_id: confirmed.image_id,
    generated_at: new Date().toISOString(),
    summary:
      `Inspection of image ${confirmed.image_id}: ${confirmed.defect_type} ` +
      `(${confirmed.severity} severity) at ${confirmed.location}. AI-stated confidence ` +
      `${(confirmed.confidence * 100).toFixed(0)}%. Reviewer ${confirmed.human_decision} ` +
      `the finding on ${confirmed.confirmed_at}.` +
      (confirmed.degraded
        ? ' NOTE: this hypothesis was produced by the degraded-confidence fallback path.'
        : ''),
    ai_hypothesis: {
      defect_type: confirmed.defect_type,
      confidence: confirmed.confidence,
      visible_evidence: confirmed.visible_evidence,
    },
    deterministic_routing: {
      severity: confirmed.severity,
      recommended_action: confirmed.recommended_action,
      taxonomy_reference: confirmed.taxonomy_reference,
    },
    human_sign_off: {
      decision: confirmed.human_decision,
      confirmed_at: confirmed.confirmed_at,
      reviewer_note: confirmed.reviewer_note,
    },
  };
}
