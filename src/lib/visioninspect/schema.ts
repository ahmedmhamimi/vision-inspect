/**
 * schema.ts
 * The structured-output contract for VisionInspect. Every layer — AI adapters, domain
 * logic, API responses, and the UI — depends on these types and validates against these
 * schemas rather than trusting shape at any boundary.
 *
 * - RawHypothesisSchema / RawHypothesis: what a vision-analysis adapter returns before any
 *   human has looked at it. This is re-validated server-side even though it came from a
 *   "structured output" API call — never trust that "we asked for JSON" means "we got
 *   schema-valid JSON" (see docs/security-checklist.md).
 * - InspectionRecordSchema / InspectionRecord: the full record as it exists after
 *   route_defect() has run, including the human_decision field which starts as
 *   'pending' and can only become 'confirmed' or 'corrected' through the confirmation
 *   gate (see components/visioninspect/ConfirmationGate.tsx and
 *   lib/visioninspect/tool-rules.ts).
 * - ConfirmedInspectionRecordSchema: a narrowed type used as the required input to
 *   generate_inspection_report(), so "you cannot generate a report for an unconfirmed
 *   inspection" is enforced by the type system, not just by convention.
 */
import { z } from 'zod';

export const DEFECT_TYPES = [
  'surface-scratch',
  'surface-dent',
  'discoloration',
  'crack',
  'missing-component',
  'misalignment',
  'contamination',
  'label-defect',
  'dimensional-deviation',
  'no-defect-detected',
] as const;

export const SEVERITY_LEVELS = ['low', 'medium', 'high'] as const;

export const RECOMMENDED_ACTIONS = [
  'accept',
  'flag-for-secondary-review',
  'reject',
  'escalate-to-senior-reviewer',
] as const;

export const HUMAN_DECISIONS = ['pending', 'confirmed', 'corrected'] as const;

export type DefectType = (typeof DEFECT_TYPES)[number];
export type Severity = (typeof SEVERITY_LEVELS)[number];
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];
export type HumanDecision = (typeof HUMAN_DECISIONS)[number];

/** What the vision-analysis port returns. Raw AI output — not yet trusted, not yet routed. */
export const RawHypothesisSchema = z.object({
  defect_type: z.enum(DEFECT_TYPES),
  visible_evidence: z
    .string()
    .min(1, 'visible_evidence must describe what is actually visible in the image')
    .max(2000),
  location: z.string().min(1).max(300),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(2000).optional().default(''),
  degraded: z.boolean().optional().default(false),
  degraded_reason: z.string().max(500).optional(),
});
export type RawHypothesis = z.infer<typeof RawHypothesisSchema>;

/** Full inspection record: AI hypothesis + deterministic routing + (eventually) human sign-off. */
export const InspectionRecordSchema = z.object({
  image_id: z.string().uuid(),
  defect_type: z.enum(DEFECT_TYPES),
  visible_evidence: z.string().min(1).max(2000),
  location: z.string().min(1).max(300),
  severity: z.enum(SEVERITY_LEVELS),
  confidence: z.number().min(0).max(1),
  recommended_action: z.enum(RECOMMENDED_ACTIONS),
  human_decision: z.enum(HUMAN_DECISIONS),
  notes: z.string().max(2000),
  taxonomy_reference: z.string().min(1),
  degraded: z.boolean().default(false),
  degraded_reason: z.string().max(500).optional(),
  created_at: z.string().datetime(),
  confirmed_at: z.string().datetime().optional(),
  reviewer_note: z.string().max(2000).optional(),
});
export type InspectionRecord = z.infer<typeof InspectionRecordSchema>;

/**
 * Narrowed schema used as the required input type for generate_inspection_report().
 * human_decision is restricted to the two "a person has acted" states, and confirmed_at
 * is required rather than optional — this is what makes "cannot report on an unconfirmed
 * record" a compile-time fact, not just a runtime check.
 */
export const ConfirmedInspectionRecordSchema = InspectionRecordSchema.extend({
  human_decision: z.enum(['confirmed', 'corrected']),
  confirmed_at: z.string().datetime(),
});
export type ConfirmedInspectionRecord = z.infer<typeof ConfirmedInspectionRecordSchema>;

/** The auditable summary produced by generate_inspection_report(). */
export const InspectionReportSchema = z.object({
  report_id: z.string().uuid(),
  image_id: z.string().uuid(),
  generated_at: z.string().datetime(),
  summary: z.string().min(1),
  ai_hypothesis: z.object({
    defect_type: z.enum(DEFECT_TYPES),
    confidence: z.number().min(0).max(1),
    visible_evidence: z.string(),
  }),
  deterministic_routing: z.object({
    severity: z.enum(SEVERITY_LEVELS),
    recommended_action: z.enum(RECOMMENDED_ACTIONS),
    taxonomy_reference: z.string(),
  }),
  human_sign_off: z.object({
    decision: z.enum(['confirmed', 'corrected']),
    confirmed_at: z.string().datetime(),
    reviewer_note: z.string().optional(),
  }),
});
export type InspectionReport = z.infer<typeof InspectionReportSchema>;

/** Request body for POST /api/visioninspect (the analyze step). */
export const AnalyzeRequestSchema = z.object({
  image_base64: z.string().min(1),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/** Request body for PATCH /api/visioninspect (the human-confirmation step). */
export const ConfirmRequestSchema = z.object({
  image_id: z.string().uuid(),
  decision: z.enum(['confirmed', 'corrected']),
  corrected_severity: z.enum(SEVERITY_LEVELS).optional(),
  corrected_recommended_action: z.enum(RECOMMENDED_ACTIONS).optional(),
  reviewer_note: z.string().max(2000).optional(),
});
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
