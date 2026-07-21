/**
 * taxonomy.ts
 * Domain-level taxonomy types and lookup helpers.
 *
 * IMPORTANT ARCHITECTURAL RULE: this file does not read from disk, does not import
 * fs/path, and does not know the taxonomy lives in a JSON file. It only knows the *shape*
 * of a Taxonomy object. Loading the actual file is the responsibility of
 * adapters/taxonomy-registry.adapter.ts, which implements ports/knowledge-registry.port.ts.
 * This keeps the domain layer testable with an in-memory taxonomy object and zero I/O.
 *
 * - TaxonomySchema / Taxonomy: the validated shape of the approved taxonomy data.
 * - findTaxonomyEntry(taxonomy, defectType): looks up the rule set for one defect type.
 * - isLowConfidence(taxonomy, confidence): checks the escalation threshold.
 */
import { z } from 'zod';
import { DEFECT_TYPES, SEVERITY_LEVELS } from './schema';

const SeverityRuleSchema = z.object({
  condition: z.string(),
  severity: z.enum(SEVERITY_LEVELS),
});

const TaxonomyEntrySchema = z.object({
  defect_type: z.enum(DEFECT_TYPES),
  label: z.string(),
  description: z.string(),
  severity_rules: z.array(SeverityRuleSchema).min(1),
  default_severity: z.enum(SEVERITY_LEVELS),
  sop_reference: z.string(),
  notes: z.string().optional(),
});
export type TaxonomyEntry = z.infer<typeof TaxonomyEntrySchema>;

export const TaxonomySchema = z.object({
  version: z.string(),
  entries: z.array(TaxonomyEntrySchema).min(1),
  confidence_escalation_threshold: z.number().min(0).max(1),
  confidence_escalation_note: z.string().optional(),
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;

export class TaxonomyEntryNotFoundError extends Error {
  constructor(defectType: string) {
    super(
      `No taxonomy entry found for defect_type "${defectType}". This means the AI adapter ` +
        `returned a defect_type outside the approved taxonomy, which the schema enum should ` +
        `already have rejected — treat this as a defect in adapter-to-domain validation, not ` +
        `a normal "unsupported input" case.`,
    );
    this.name = 'TaxonomyEntryNotFoundError';
  }
}

/** Finds the approved taxonomy entry for a given defect type. Throws if not found, since a
 *  schema-valid defect_type reaching here without a matching entry indicates the taxonomy
 *  data and the schema enum have drifted out of sync — a data-integrity bug, not user error. */
export function findTaxonomyEntry(taxonomy: Taxonomy, defectType: string): TaxonomyEntry {
  const entry = taxonomy.entries.find((e) => e.defect_type === defectType);
  if (!entry) {
    throw new TaxonomyEntryNotFoundError(defectType);
  }
  return entry;
}

/** True when a hypothesis's confidence falls below the approved escalation threshold. */
export function isLowConfidence(taxonomy: Taxonomy, confidence: number): boolean {
  return confidence < taxonomy.confidence_escalation_threshold;
}
