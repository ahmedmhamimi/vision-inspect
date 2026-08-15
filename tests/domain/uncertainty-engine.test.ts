/**
 * uncertainty-engine.test.ts
 * Unit tests verifying the 4 Black-Box Uncertainty Estimation techniques
 * (U_prediction, U_image, U_semantic, U_evidence, and composite U_composite).
 */
import { describe, expect, it } from 'vitest';
import {
  calculateEvidenceUncertainty,
  calculateImageQualityUncertainty,
  calculatePredictionUncertainty,
  calculateSemanticUncertainty,
  computeUncertaintyMetrics,
} from '@/lib/visioninspect/uncertainty/uncertainty-engine';
import type { RawHypothesis } from '@/lib/visioninspect/schema';

describe('Uncertainty Engine (UAVI Spec)', () => {
  it('Technique 1 (U_prediction): calculates 0 disagreement for unanimous 5/5 votes', () => {
    const hypotheses: RawHypothesis[] = Array(5).fill({
      defect_type: 'crack',
      visible_evidence: 'Deep surface fracture',
      location: 'Top right',
      confidence: 0.9,
      notes: '',
      degraded: false,
    });

    const u_pred = calculatePredictionUncertainty(hypotheses);
    expect(u_pred).toBe(0);
  });

  it('Technique 1 (U_prediction): calculates correct disagreement for 3/5 vs 2/5 split votes', () => {
    const hypotheses: RawHypothesis[] = [
      { defect_type: 'crack', visible_evidence: 'E1', location: 'L', confidence: 0.8, notes: '', degraded: false },
      { defect_type: 'crack', visible_evidence: 'E1', location: 'L', confidence: 0.8, notes: '', degraded: false },
      { defect_type: 'crack', visible_evidence: 'E1', location: 'L', confidence: 0.8, notes: '', degraded: false },
      { defect_type: 'surface-scratch', visible_evidence: 'E2', location: 'L', confidence: 0.7, notes: '', degraded: false },
      { defect_type: 'surface-scratch', visible_evidence: 'E2', location: 'L', confidence: 0.7, notes: '', degraded: false },
    ];

    const u_pred = calculatePredictionUncertainty(hypotheses);
    expect(u_pred).toBeCloseTo(0.4, 2);
  });

  it('Technique 2 (U_image): evaluates blur and saturation on image buffers', () => {
    const fakeBuffer = Buffer.from(Array(1000).fill(128)); // Uniform grey buffer
    const cvMetrics = calculateImageQualityUncertainty(fakeBuffer, 1920, 1080);

    expect(cvMetrics.u_image).toBeGreaterThanOrEqual(0);
    expect(cvMetrics.u_image).toBeLessThanOrEqual(1);
    expect(cvMetrics.blur_score).toBeDefined();
    expect(cvMetrics.exposure_score).toBeDefined();
  });

  it('Technique 3 (U_semantic): evaluates rationale textual similarity', () => {
    const hypothesesSame: RawHypothesis[] = [
      { defect_type: 'crack', visible_evidence: 'Fracture on glass panel', location: 'Screen', confidence: 0.9, notes: '', degraded: false },
      { defect_type: 'crack', visible_evidence: 'Fracture on glass panel', location: 'Screen', confidence: 0.9, notes: '', degraded: false },
    ];

    const u_sem_same = calculateSemanticUncertainty(hypothesesSame);
    expect(u_sem_same).toBeLessThan(0.2);
  });

  it('Technique 4 (U_evidence): produces higher uncertainty when verifier unsupported', () => {
    const hyp: RawHypothesis = {
      defect_type: 'discoloration',
      visible_evidence: 'Slight yellowing',
      location: 'Bezel',
      confidence: 0.7,
      notes: '',
      degraded: false,
    };

    const u_evid_supported = calculateEvidenceUncertainty(hyp, true);
    const u_evid_unsupported = calculateEvidenceUncertainty(hyp, false);

    expect(u_evid_unsupported).toBeGreaterThan(u_evid_supported);
  });

  it('Composite Uncertainty: computes fused U_composite bounded between 0 and 1', () => {
    const fakeBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const hypotheses: RawHypothesis[] = [
      { defect_type: 'crack', visible_evidence: 'Visible crack', location: 'Center', confidence: 0.95, notes: '', degraded: false },
    ];

    const metrics = computeUncertaintyMetrics(hypotheses, fakeBuffer, 1920, 1080);

    expect(metrics.u_composite).toBeGreaterThanOrEqual(0);
    expect(metrics.u_composite).toBeLessThanOrEqual(1);
    expect(metrics.u_prediction).toBeDefined();
    expect(metrics.u_image).toBeDefined();
    expect(metrics.u_semantic).toBeDefined();
    expect(metrics.u_evidence).toBeDefined();
  });
});
