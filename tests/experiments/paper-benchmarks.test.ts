/**
 * paper-benchmarks.test.ts
 * Vitest runner that executes the UAVI paper experiment benchmark suite.
 */
import { describe, expect, it } from 'vitest';
import { runPaperExperiments } from '../../scripts/run-paper-experiments';

describe('UAVI Research Paper Experiment Suite', () => {
  it('executes full paper benchmark suite, validates ECE improvement, and exports LaTeX/Markdown tables', () => {
    const results = runPaperExperiments();

    // 1. ECE Improvement: Fused ECE should be significantly lower than single-shot ECE
    expect(results.fusedECE).toBeLessThan(results.singleShotECE);

    // 2. High Error Discrimination: Fused AUROC should exceed 0.75
    expect(results.fusedAUROC).toBeGreaterThan(0.75);

    // 3. Safety Guarantee: VisionInspect Policy Violation Rate (PVR) must be strictly 0%
    expect(results.visionInspectPVR).toBe(0.0);
  });
});
