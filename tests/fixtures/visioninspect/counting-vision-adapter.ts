/**
 * counting-vision-adapter.ts
 * Wraps any VisionAnalysisPort and counts how many times analyze() was called. Used to
 * prove, not just assert by convention, that invalid input never reaches a provider — see
 * the "does not call the provider on invalid input" test in
 * tests/api/visioninspect.test.ts.
 */
import type { RawHypothesis } from '@/lib/visioninspect/schema';
import type { AnalyzeImageInput, VisionAnalysisPort } from '@/lib/visioninspect/ports/vision-analysis.port';

export class CountingVisionAdapter implements VisionAnalysisPort {
  callCount = 0;

  constructor(private readonly inner: VisionAnalysisPort) {}

  get providerName(): string {
    return this.inner.providerName;
  }

  async analyze(input: AnalyzeImageInput): Promise<RawHypothesis> {
    this.callCount += 1;
    return this.inner.analyze(input);
  }
}
