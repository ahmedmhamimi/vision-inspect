/**
 * chat.port.ts
 * Outbound port: how the application asks *some* provider to answer a question about a
 * specific, already-analyzed inspection, without knowing or caring which provider.
 * Mirrors vision-analysis.port.ts's shape deliberately, for the same reason: swapping the
 * concrete adapter at the composition root should never require touching service.ts.
 *
 * This is intentionally its own port rather than a new method bolted onto
 * VisionAnalysisPort — analyzing a fresh image and discussing an already-routed record
 * are different capabilities with different inputs (one takes raw image bytes, the other
 * takes a full InspectionRecord plus a conversation transcript), and a fake vision adapter
 * used in tests has no reason to also implement chat.
 *
 * - ChatPort: the interface itself.
 * - ChatError: thrown by adapters on failure; service.ts catches this specific type to
 *   turn it into a safe, generic ChatUnavailableError for the route handler.
 */
import type { ChatMessage, InspectionRecord } from '../schema';

export interface ChatAboutImageInput {
  /** The full record being discussed — includes the AI hypothesis, the deterministic
   *  routing, the human decision, and (when available) the original image itself. */
  record: InspectionRecord;
  /** Prior turns in this conversation, oldest first. Never includes `message`. */
  history: ChatMessage[];
  /** The newest user message, not yet part of `history`. */
  message: string;
}

export class ChatError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export interface ChatPort {
  /** Human-readable provider name, used in logs. */
  readonly providerName: string;

  /** Answers a single chat turn about the given inspection. Must throw ChatError (never a
   *  bare Error) on any failure. Must NOT persist anything — the chat is ephemeral by
   *  design; the caller resends the full transcript on every turn. */
  reply(input: ChatAboutImageInput): Promise<string>;
}
