/**
 * fake-vision.adapter.ts
 * A deterministic, in-memory implementation of VisionAnalysisPort used ONLY in tests.
 * Never imported by service.ts, route.ts, or composition-root.ts in the running app —
 * only by tests/domain/tool-rules.test.ts and tests/api/visioninspect.test.ts.
 *
 * This is what makes "run.py"-equivalent testing possible with zero API keys: swap this
 * in at the port boundary and the entire pipeline downstream of "an adapter returned a
 * hypothesis" runs exactly as it would in production, with fully predictable output.
 *
 * - FakeVisionAdapter: returns whatever hypothesis (or error) it was configured with.
 * - makeHypothesis(overrides): a small builder for constructing valid RawHypothesis test
 *   fixtures without repeating every field in every test.
 */
import { RawHypothesisSchema, type RawHypothesis } from '../schema';
import {
  VisionAnalysisError,
  type AnalyzeImageInput,
  type VisionAnalysisPort,
} from '../ports/vision-analysis.port';

export class FakeVisionAdapter implements VisionAnalysisPort {
  readonly providerName = 'fake-test-adapter';

  constructor(
    private readonly config:
      | { mode: 'success'; hypothesis: RawHypothesis }
      | { mode: 'error'; message: string } = {
      mode: 'success',
      hypothesis: makeHypothesis(),
    },
  ) {}

  async analyze(_input: AnalyzeImageInput): Promise<RawHypothesis> {
    if (this.config.mode === 'error') {
      throw new VisionAnalysisError(this.config.message, this.providerName);
    }
    return RawHypothesisSchema.parse(this.config.hypothesis);
  }
}

/** Builds a valid RawHypothesis for tests, with sensible defaults and easy overrides. */
export function makeHypothesis(overrides: Partial<RawHypothesis> = {}): RawHypothesis {
  return RawHypothesisSchema.parse({
    defect_type: 'surface-scratch',
    visible_evidence: 'A linear mark approximately 3cm long visible on the top surface.',
    location: 'top-left quadrant',
    confidence: 0.82,
    notes: '',
    degraded: false,
    ...overrides,
  });
}
