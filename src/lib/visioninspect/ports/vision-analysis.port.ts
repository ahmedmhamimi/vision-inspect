/**
 * vision-analysis.port.ts
 * Outbound port: how the application asks for a defect hypothesis from *some* vision
 * analysis provider, without knowing or caring which one.
 *
 * Owned by: Shaza (AI & Backend Engineer) — she also owns every adapter that implements
 * this port (gemini-vision.adapter.ts, groq-fallback.adapter.ts) and the fake adapter used
 * in tests (fake-vision.adapter.ts).
 *
 * Any class implementing VisionAnalysisPort can be swapped in at the composition root
 * with zero changes to service.ts or the domain layer. This is what lets
 * tests/domain/tool-rules.test.ts run with a fake adapter and zero API keys, and what
 * lets the service layer fail over from Gemini to Groq without an if/else on provider
 * name anywhere outside providers.ts.
 *
 * - VisionAnalysisPort: the interface itself.
 * - VisionAnalysisError: thrown by adapters on failure; callers (service.ts) catch this
 *   specific type to decide whether to fail over to the next provider.
 */
import type { RawHypothesis } from '../schema';

export interface AnalyzeImageInput {
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class VisionAnalysisError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VisionAnalysisError';
  }
}

export interface VisionAnalysisPort {
  /** Human-readable provider name, used in logs and in the degraded_reason field when a
   *  fallback provider is used instead of the primary. */
  readonly providerName: string;

  /** Analyzes an image and returns a raw hypothesis. Must throw VisionAnalysisError
   *  (never a bare Error) on any failure, so the service layer can reliably catch and
   *  fail over. Must NOT throw on a "no defect found" result — that is a valid
   *  hypothesis with defect_type: 'no-defect-detected', not an error. */
  analyze(input: AnalyzeImageInput): Promise<RawHypothesis>;
}
