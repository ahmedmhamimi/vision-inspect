/**
 * groq-fallback.adapter.ts
 * Fallback VisionAnalysisPort implementation, used only when the Gemini adapter throws.
 * Groq's chat models used here are text-only — this adapter CANNOT see the image, so it
 * cannot genuinely re-analyze it. It exists to keep the application responsive during a
 * primary-provider outage rather than to produce an equivalent-quality hypothesis.
 *
 * Every response from this adapter has degraded: true and a degraded_reason, and
 * confidence is deliberately capped low (see MAX_DEGRADED_CONFIDENCE) so that
 * route_defect()'s confidence-escalation rule reliably routes degraded hypotheses to
 * 'escalate-to-senior-reviewer' rather than letting a fallback response auto-route as if
 * it were a real visual analysis.
 *
 * ⚠️ VERIFICATION NOTE FOR THE TEAM: written against the documented groq-sdk chat
 * completions shape but not executed against the live Groq API in this environment — see
 * the same note in gemini-vision.adapter.ts. Verify before relying on it.
 *
 * - GroqFallbackAdapter: implements VisionAnalysisPort using a text-only degraded path.
 */
import Groq from 'groq-sdk';
import { RawHypothesisSchema, type RawHypothesis } from '../schema';
import { getGroqApiKey } from '@/lib/ai/providers';
import {
  VisionAnalysisError,
  type AnalyzeImageInput,
  type VisionAnalysisPort,
} from '../ports/vision-analysis.port';

const ANALYSIS_TIMEOUT_MS = 15_000;
const MAX_DEGRADED_CONFIDENCE = 0.3;
const DEGRADED_REASON =
  'Primary provider (Gemini) was unavailable. This response was produced by a ' +
  'text-only fallback provider that cannot see the uploaded image, and should not be ' +
  'treated as a real visual analysis.';

export class GroqFallbackAdapter implements VisionAnalysisPort {
  readonly providerName = 'groq-fallback';
  private readonly client: Groq;

  constructor(private readonly model: string = 'llama-3.3-70b-versatile') {
    this.client = new Groq({ apiKey: getGroqApiKey() });
  }

  async analyze(_input: AnalyzeImageInput): Promise<RawHypothesis> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are standing in for an unavailable image-analysis service. You ' +
                'cannot see any image. Respond with ONLY this JSON shape: ' +
                '{"defect_type":"no-defect-detected","visible_evidence":"<explanation ' +
                'that no visual analysis was possible>","location":"unknown",' +
                '"confidence":<a number you will output, will be overridden by the ' +
                'caller>,"notes":"<brief note>"}. Do not invent a specific defect — you ' +
                'have no visual information to base one on.',
            },
            {
              role: 'user',
              content:
                'The primary image-analysis provider is unavailable. Produce the ' +
                'fallback JSON response described in the system message.',
            },
          ],
        },
        { signal: controller.signal },
      );

      const rawText = completion.choices[0]?.message?.content;
      if (!rawText) {
        throw new VisionAnalysisError(
          'Groq fallback returned an empty response body.',
          this.providerName,
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (cause) {
        throw new VisionAnalysisError(
          'Groq fallback response was not valid JSON.',
          this.providerName,
          cause,
        );
      }

      const candidate = { ...(parsedJson as Record<string, unknown>) };
      // Force the degraded markers and cap confidence regardless of what the model said —
      // this is not something we let the fallback model decide for itself.
      candidate.degraded = true;
      candidate.degraded_reason = DEGRADED_REASON;
      candidate.confidence = Math.min(
        typeof candidate.confidence === 'number' ? candidate.confidence : 0.1,
        MAX_DEGRADED_CONFIDENCE,
      );

      const validated = RawHypothesisSchema.safeParse(candidate);
      if (!validated.success) {
        throw new VisionAnalysisError(
          `Groq fallback response did not match the expected schema: ` +
            `${validated.error.message}`,
          this.providerName,
        );
      }

      return validated.data;
    } catch (err) {
      if (err instanceof VisionAnalysisError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new VisionAnalysisError(
        isAbort
          ? `Groq fallback request timed out after ${ANALYSIS_TIMEOUT_MS}ms.`
          : 'Groq fallback request failed. Both providers are now unavailable.',
        this.providerName,
        err,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
