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

export const UncertaintyMetricsSchema = z.object({
  u_prediction: z.number().min(0).max(1),
  u_image: z.number().min(0).max(1),
  u_semantic: z.number().min(0).max(1),
  u_evidence: z.number().min(0).max(1),
  u_composite: z.number().min(0).max(1),
  samples_count: z.number().int().positive().default(1),
  blur_score: z.number().min(0).max(1).optional(),
  exposure_score: z.number().min(0).max(1).optional(),
  resolution_score: z.number().min(0).max(1).optional(),
});
export type UncertaintyMetrics = z.infer<typeof UncertaintyMetricsSchema>;

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
  uncertainty_metrics: UncertaintyMetricsSchema.optional(),
  created_at: z.string().datetime(),
  confirmed_at: z.string().datetime().optional(),
  reviewer_note: z.string().max(2000).optional(),
  // The original uploaded image, base64-encoded, persisted alongside the record so the
  // full inspection (not just its diagnosis) can be reviewed later from history — see
  // components/visioninspect/InfoModal.tsx. Stored as bytea in Supabase (genuinely
  // binary on disk) and surfaced to the app layer as base64 text, which is what the
  // browser needs to render it via a data: URI. Optional because records saved before
  // this field existed have no image on file.
  image_base64: z.string().optional(),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  // The authenticated reviewer who ran this inspection, set server-side from the Supabase
  // Auth session in the Route Handler — never trusted from the request body. Optional
  // because records saved before authentication existed (or via the file-storage
  // adapter, which has no notion of users) have no owner on file. Powers the admin
  // dashboard's "submitted by" column; see migrations/002_add_authentication.sql.
  created_by: z.string().uuid().optional(),
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

/**
 * A single turn in the per-image chat. Deliberately NOT part of InspectionRecord or any
 * persisted schema — the chat is entirely ephemeral (see docs on ChatModal.tsx and
 * chat/route.ts). The client holds the full transcript in memory for the life of the
 * page and resends it with every turn; the server never stores it anywhere.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Request body for POST /api/visioninspect/chat. */
export const ChatRequestSchema = z.object({
  image_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  // Prior turns only — the new user message goes in `message`, not appended here. Capped
  // well below any provider context limit; a reviewer chatting about one image for that
  // long is not a case this feature needs to optimize for.
  history: z.array(ChatMessageSchema).max(40).default([]),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

