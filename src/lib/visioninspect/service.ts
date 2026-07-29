/**
 * service.ts
 * Orchestrates the analyze pipeline: validated image in → routed InspectionRecord out.
 * Owned by Shaza (AI & Backend Engineer). This file is the only place that sequences
 * "try the primary provider, fall back to the secondary on failure" — that sequencing
 * logic does not belong in the route handler (which should stay a thin HTTP boundary) or
 * in the domain layer (which must not know providers exist at all).
 *
 * - analyzeAndRoute(input): the main entry point called by the API route.
 * - confirmInspection(imageId, decision): applies a human decision and persists the
 *   result.
 * - generateAndSaveReport(imageId): generates the report for a confirmed record and
 *   persists it — throws UnconfirmedRecordError (via generateInspectionReport) if the
 *   record is not actually confirmed.
 * - chatAboutInspection(imageId, history, message): answers one turn of the ephemeral
 *   per-image chat. Deliberately does not touch the report sink except to *read* the
 *   record it needs for grounding — nothing about the conversation itself is persisted,
 *   by design (see ChatModal.tsx and chat/route.ts).
 */
import { randomUUID } from 'crypto';
import {
  getChatProvider,
  getKnowledgeRegistry,
  getReportSink,
  getVisionAnalysisChain,
} from './composition-root';
import type { ChatMessage, ConfirmRequest, InspectionRecord, InspectionReport } from './schema';
import { ConfirmedInspectionRecordSchema } from './schema';
import { applyHumanDecision, generateInspectionReport, routeDefect } from './tool-rules';
import { VisionAnalysisError, type AnalyzeImageInput } from './ports/vision-analysis.port';
import { ChatError } from './ports/chat.port';

export class AnalysisUnavailableError extends Error {
  constructor(public readonly attempts: { provider: string; message: string }[]) {
    super(
      `All vision-analysis providers failed: ` +
        attempts.map((a) => `${a.provider} (${a.message})`).join('; '),
    );
    this.name = 'AnalysisUnavailableError';
  }
}

export class RecordNotFoundError extends Error {
  constructor(imageId: string) {
    super(`No inspection record found for image_id "${imageId}".`);
    this.name = 'RecordNotFoundError';
  }
}

export class ChatUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatUnavailableError';
  }
}

/**
 * Runs the full analyze pipeline. Tries each adapter in the vision-analysis chain in
 * order (Gemini, then Groq fallback), returning the first successful hypothesis, then
 * routes it deterministically and persists the resulting pending record.
 *
 * Throws AnalysisUnavailableError only if every adapter in the chain failed — the caller
 * (route.ts) maps this to a safe 502-style response.
 */
export async function analyzeAndRoute(input: AnalyzeImageInput): Promise<InspectionRecord> {
  const chain = getVisionAnalysisChain();
  const attempts: { provider: string; message: string }[] = [];

  for (const adapter of chain) {
    try {
      const hypothesis = await adapter.analyze(input);
      const taxonomy = await getKnowledgeRegistry().getTaxonomy();
      const imageId = randomUUID();
      const routedRecord = routeDefect(hypothesis, imageId, taxonomy);

      // Attach the original image here, at the integration layer, rather than inside
      // routeDefect() itself — routeDefect is a pure deterministic tool (see
      // tool-rules.ts) and must stay that way. Persisting the image is a storage
      // concern, so it's bolted on right before the one saveRecord() call that
      // persists this record for the first time.
      const record: InspectionRecord = {
        ...routedRecord,
        image_base64: input.imageBuffer.toString('base64'),
        mime_type: input.mimeType,
      };

      await getReportSink().saveRecord(record);
      return record;
    } catch (err) {
      if (err instanceof VisionAnalysisError) {
        // Log every individual provider failure, not just the case where the whole
        // chain fails. Without this, a persistently-broken primary provider (dead
        // model name, expired key, quota exceeded) silently degrades every request to
        // the fallback with no visible trace anywhere — exactly the bug found during
        // this project's own live testing, where a shut-down Gemini model name caused
        // every single request to fall back to Groq with no error surfaced to anyone.
        console.error(
          `[visioninspect:analyzeAndRoute] Provider "${err.provider}" failed, ` +
            `trying next in chain: ${err.message}`,
        );
        attempts.push({ provider: err.provider, message: err.message });
        continue; // try the next adapter in the chain
      }
      throw err; // an unexpected error (e.g. a taxonomy load failure) is not a provider
      // failure and should not be silently swallowed as one
    }
  }

  throw new AnalysisUnavailableError(attempts);
}

/** Applies a human reviewer's decision to a previously routed record and persists it. */
export async function confirmInspection(
  imageId: string,
  decision: ConfirmRequest,
): Promise<InspectionRecord> {
  const sink = getReportSink();
  const existing = await sink.getRecord(imageId);
  if (!existing) {
    throw new RecordNotFoundError(imageId);
  }

  const updated = applyHumanDecision(existing, decision);
  await sink.saveRecord(updated);
  return updated;
}

/**
 * Generates and persists the auditable report for a confirmed record. Delegates the
 * actual "is this really confirmed" check to generateInspectionReport() itself, so the
 * guarantee lives in one place (tool-rules.ts) rather than being re-implemented here.
 */
export async function generateAndSaveReport(imageId: string): Promise<InspectionReport> {
  const sink = getReportSink();
  const record = await sink.getRecord(imageId);
  if (!record) {
    throw new RecordNotFoundError(imageId);
  }

  // Re-validate as a ConfirmedInspectionRecord here too (in addition to the check inside
  // generateInspectionReport itself) so a RecordNotFoundError-shaped 404 versus an
  // UnconfirmedRecordError-shaped 409 can be told apart cleanly by the route handler.
  const parsed = ConfirmedInspectionRecordSchema.parse(record);
  const report = generateInspectionReport(parsed);
  await sink.saveReport(report);
  return report;
}

export async function listInspectionHistory(limit?: number): Promise<InspectionRecord[]> {
  return getReportSink().listRecords(limit);
}

export async function deleteInspection(imageId: string): Promise<void> {
  const sink = getReportSink();
  // We check if it exists first just to throw 404 cleanly if not, but it's optional.
  // Actually, sink.deleteRecord might not throw if not exists, but let's keep it simple.
  await sink.deleteRecord(imageId);
}

/**
 * Answers one turn of the per-image chat. Reads the record (for grounding: the image, the
 * AI hypothesis, the routing, the human decision) but writes nothing — the chat transcript
 * itself lives only in the caller's memory for this one request and in the browser tab
 * that's driving it, never in the report sink or anywhere else. That's a deliberate
 * product decision (see ChatModal.tsx), not just an unimplemented feature.
 */
export async function chatAboutInspection(
  imageId: string,
  history: ChatMessage[],
  message: string,
): Promise<string> {
  const record = await getReportSink().getRecord(imageId);
  if (!record) {
    throw new RecordNotFoundError(imageId);
  }

  try {
    return await getChatProvider().reply({ record, history, message });
  } catch (err) {
    if (err instanceof ChatError) {
      console.error(`[visioninspect:chatAboutInspection] Provider "${err.provider}" failed: ${err.message}`);
      throw new ChatUnavailableError(
        'The chat assistant is temporarily unavailable. Please try again shortly.',
      );
    }
    throw err;
  }
}