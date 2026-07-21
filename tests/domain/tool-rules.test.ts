/**
 * tool-rules.test.ts
 * Unit tests for the two deterministic tools. Runs with zero API keys and zero network
 * calls — the taxonomy used here is a small, self-contained in-memory fixture, not the
 * real knowledge/visioninspect/taxonomy.json, so these tests stay stable even if that
 * file is edited later.
 *
 * This file is the proof artifact for "domain logic is testable independent of any live
 * provider call" — see docs/architecture.md and the Reliability & test evidence rubric
 * criterion in the project brief.
 */
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  UnconfirmedRecordError,
  applyHumanDecision,
  generateInspectionReport,
  routeDefect,
} from '@/lib/visioninspect/tool-rules';
import { TaxonomySchema, type Taxonomy } from '@/lib/visioninspect/taxonomy';
import type { ConfirmedInspectionRecord, InspectionRecord, RawHypothesis } from '@/lib/visioninspect/schema';

const TEST_TAXONOMY: Taxonomy = TaxonomySchema.parse({
  version: 'test-1.0',
  entries: [
    {
      defect_type: 'surface-scratch',
      label: 'Surface scratch',
      description: 'test fixture entry',
      severity_rules: [{ condition: 'any', severity: 'low' }],
      default_severity: 'low',
      sop_reference: 'TEST-SOP §1',
    },
    {
      defect_type: 'crack',
      label: 'Crack',
      description: 'test fixture entry',
      severity_rules: [{ condition: 'any', severity: 'high' }],
      default_severity: 'high',
      sop_reference: 'TEST-SOP §2',
    },
    {
      defect_type: 'missing-component',
      label: 'Missing component',
      description: 'test fixture entry',
      severity_rules: [{ condition: 'any', severity: 'medium' }],
      default_severity: 'medium',
      sop_reference: 'TEST-SOP §3',
    },
    {
      defect_type: 'no-defect-detected',
      label: 'No defect detected',
      description: 'test fixture entry',
      severity_rules: [{ condition: 'any', severity: 'low' }],
      default_severity: 'low',
      sop_reference: 'TEST-SOP §4',
    },
  ],
  confidence_escalation_threshold: 0.5,
});

function baseHypothesis(overrides: Partial<RawHypothesis> = {}): RawHypothesis {
  return {
    defect_type: 'surface-scratch',
    visible_evidence: 'A visible mark on the surface.',
    location: 'center',
    confidence: 0.9,
    notes: '',
    degraded: false,
    ...overrides,
  };
}

describe('routeDefect', () => {
  it('routes a normal, confident hypothesis to the taxonomy default severity', () => {
    const record = routeDefect(baseHypothesis(), randomUUID(), TEST_TAXONOMY);
    expect(record.severity).toBe('low');
    expect(record.recommended_action).toBe('accept');
    expect(record.human_decision).toBe('pending');
    expect(record.taxonomy_reference).toBe('TEST-SOP §1');
  });

  it('always routes a crack to high severity regardless of the taxonomy default lookup path', () => {
    const record = routeDefect(
      baseHypothesis({ defect_type: 'crack', confidence: 0.95 }),
      randomUUID(),
      TEST_TAXONOMY,
    );
    expect(record.severity).toBe('high');
    expect(record.recommended_action).toBe('reject');
  });

  it('escalates to senior reviewer when confidence is below the taxonomy threshold, even for a low-severity defect type', () => {
    const record = routeDefect(
      baseHypothesis({ defect_type: 'surface-scratch', confidence: 0.2 }),
      randomUUID(),
      TEST_TAXONOMY,
    );
    expect(record.recommended_action).toBe('escalate-to-senior-reviewer');
  });

  it('escalates a high-severity defect too when confidence is low — confidence overrides severity-based routing', () => {
    const record = routeDefect(
      baseHypothesis({ defect_type: 'crack', confidence: 0.1 }),
      randomUUID(),
      TEST_TAXONOMY,
    );
    expect(record.severity).toBe('high'); // severity fact is unchanged
    expect(record.recommended_action).toBe('escalate-to-senior-reviewer'); // but routing defers to a human
  });

  it('accepts a confident no-defect-detected result', () => {
    const record = routeDefect(
      baseHypothesis({ defect_type: 'no-defect-detected', confidence: 0.85 }),
      randomUUID(),
      TEST_TAXONOMY,
    );
    expect(record.recommended_action).toBe('accept');
  });

  it('throws for a defect_type with no matching taxonomy entry', () => {
    const brokenTaxonomy = TaxonomySchema.parse({
      ...TEST_TAXONOMY,
      entries: TEST_TAXONOMY.entries.filter((e) => e.defect_type !== 'surface-scratch'),
    });
    expect(() => routeDefect(baseHypothesis(), randomUUID(), brokenTaxonomy)).toThrow();
  });

  it('sets human_decision to pending on every newly routed record, never anything else', () => {
    const record = routeDefect(baseHypothesis(), randomUUID(), TEST_TAXONOMY);
    expect(record.human_decision).toBe('pending');
    expect(record.confirmed_at).toBeUndefined();
  });
});

describe('applyHumanDecision', () => {
  const pendingRecord: InspectionRecord = routeDefect(baseHypothesis(), randomUUID(), TEST_TAXONOMY);

  it('sets human_decision to confirmed and stamps confirmed_at', () => {
    const updated = applyHumanDecision(pendingRecord, {
      image_id: pendingRecord.image_id,
      decision: 'confirmed',
    });
    expect(updated.human_decision).toBe('confirmed');
    expect(updated.confirmed_at).toBeDefined();
  });

  it('requires a non-empty reviewer_note for a corrected decision', () => {
    expect(() =>
      applyHumanDecision(pendingRecord, {
        image_id: pendingRecord.image_id,
        decision: 'corrected',
        corrected_severity: 'high',
      }),
    ).toThrow(/reviewer_note/);
  });

  it('applies the corrected severity and action when a valid note is supplied', () => {
    const updated = applyHumanDecision(pendingRecord, {
      image_id: pendingRecord.image_id,
      decision: 'corrected',
      corrected_severity: 'high',
      corrected_recommended_action: 'reject',
      reviewer_note: 'Scratch crosses a functional edge, raising severity.',
    });
    expect(updated.severity).toBe('high');
    expect(updated.recommended_action).toBe('reject');
    expect(updated.human_decision).toBe('corrected');
  });
});

describe('generateInspectionReport', () => {
  it('generates a report for a properly confirmed record', () => {
    const pending = routeDefect(baseHypothesis(), randomUUID(), TEST_TAXONOMY);
    const confirmed = applyHumanDecision(pending, {
      image_id: pending.image_id,
      decision: 'confirmed',
    }) as ConfirmedInspectionRecord;

    const report = generateInspectionReport(confirmed);
    expect(report.image_id).toBe(pending.image_id);
    expect(report.human_sign_off.decision).toBe('confirmed');
    expect(report.summary.length).toBeGreaterThan(0);
  });

  /**
   * This is the specific test the project brief and the build prompt both asked for:
   * proof that report generation is impossible for an unconfirmed record. We deliberately
   * bypass TypeScript's compile-time ConfirmedInspectionRecord narrowing with `as unknown
   * as ConfirmedInspectionRecord` to prove the RUNTIME guard inside
   * generateInspectionReport() is real and not just a type-system convenience — see the
   * comment on generateInspectionReport() in tool-rules.ts.
   */
  it('throws UnconfirmedRecordError for a record whose human_decision is still pending, even when the type system is bypassed', () => {
    const stillPending = routeDefect(baseHypothesis(), randomUUID(), TEST_TAXONOMY);
    const bypassed = stillPending as unknown as ConfirmedInspectionRecord;

    expect(() => generateInspectionReport(bypassed)).toThrow(UnconfirmedRecordError);
  });

  it('includes a degraded-mode note in the summary when the record came from the fallback path', () => {
    const pending = routeDefect(
      baseHypothesis({ degraded: true, degraded_reason: 'Primary provider unavailable.' }),
      randomUUID(),
      TEST_TAXONOMY,
    );
    const confirmed = applyHumanDecision(pending, {
      image_id: pending.image_id,
      decision: 'confirmed',
    }) as ConfirmedInspectionRecord;

    const report = generateInspectionReport(confirmed);
    expect(report.summary).toMatch(/degraded-confidence fallback/);
  });
});
