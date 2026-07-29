/**
 * composition-root.ts
 * The ONE file in the codebase where concrete adapters are wired to ports. Every other
 * file — the domain layer, the service layer, the route handler — depends only on port
 * interfaces. This file is what proves that dependency claim true: if you can swap an
 * adapter here without touching service.ts or tool-rules.ts, the architecture is actually
 * hexagonal and not just organized into folders that happen to be named after the pattern.
 *
 * Owned by: Ahmed (Integration Lead / Solution Architect). This is the artifact he uses
 * to walk through the integration during the individual defense — one file that shows
 * every module's contract being honored.
 *
 * - getVisionAnalysisChain(): returns the ordered [primary, fallback] adapters the
 *   service layer tries in sequence.
 * - getKnowledgeRegistry(): returns the taxonomy source.
 * - getReportSink(): returns the persistence adapter.
 * - getChatProvider(): returns the adapter that answers per-image chat turns. Deliberately
 *   always Groq, never Gemini — a separate, cheaper text-only provider dedicated to the
 *   conversational nice-to-have, so chat traffic never competes with or falls back onto
 *   the primary vision-analysis provider's quota. No fallback chain: a chat failure just
 *   surfaces as "try again".
 * - resetCompositionForTests(): allows tests to inject fakes without needing real env vars.
 */
import { GeminiVisionAdapter } from './adapters/gemini-vision.adapter';
import { GroqFallbackAdapter } from './adapters/groq-fallback.adapter';
import { GroqChatAdapter } from './adapters/groq-chat.adapter';
import { ReportStorageAdapter } from './adapters/report-storage.adapter';
import { SupabaseStorageAdapter } from './adapters/supabase-storage.adapter';
import { TaxonomyRegistryAdapter } from './adapters/taxonomy-registry.adapter';
import type { ChatPort } from './ports/chat.port';
import type { KnowledgeRegistryPort } from './ports/knowledge-registry.port';
import type { ReportSinkPort } from './ports/report-sink.port';
import type { VisionAnalysisPort } from './ports/vision-analysis.port';

let visionChainOverride: VisionAnalysisPort[] | null = null;
let knowledgeRegistryOverride: KnowledgeRegistryPort | null = null;
let reportSinkOverride: ReportSinkPort | null = null;
let chatProviderOverride: ChatPort | null = null;

/** Returns the ordered chain of vision-analysis providers to try: Gemini first, Groq as
 *  the degraded fallback if Gemini throws. service.ts is responsible for the try/catch
 *  sequencing — this function only decides WHICH adapters exist and in WHAT order,
 *  matching the "application validates and executes, model/provider only proposes"
 *  principle used throughout this codebase. */
export function getVisionAnalysisChain(): VisionAnalysisPort[] {
  if (visionChainOverride) return visionChainOverride;
  return [new GeminiVisionAdapter(), new GroqFallbackAdapter()];
}

export function getKnowledgeRegistry(): KnowledgeRegistryPort {
  if (knowledgeRegistryOverride) return knowledgeRegistryOverride;
  return new TaxonomyRegistryAdapter();
}

export function getReportSink(): ReportSinkPort {
  if (reportSinkOverride) return reportSinkOverride;
  if (process.env.SUPABASE_URL) {
    return new SupabaseStorageAdapter();
  }
  return new ReportStorageAdapter();
}

export function getChatProvider(): ChatPort {
  if (chatProviderOverride) return chatProviderOverride;
  return new GroqChatAdapter();
}

/**
 * Test-only override hooks. Used by tests/api/visioninspect.test.ts to inject
 * FakeVisionAdapter and in-memory port implementations without requiring real API keys
 * or touching the real filesystem-backed report store. Production code never calls this.
 */
export function __setCompositionForTests(overrides: {
  visionChain?: VisionAnalysisPort[];
  knowledgeRegistry?: KnowledgeRegistryPort;
  reportSink?: ReportSinkPort;
  chatProvider?: ChatPort;
}): void {
  if (overrides.visionChain) visionChainOverride = overrides.visionChain;
  if (overrides.knowledgeRegistry) knowledgeRegistryOverride = overrides.knowledgeRegistry;
  if (overrides.reportSink) reportSinkOverride = overrides.reportSink;
  if (overrides.chatProvider) chatProviderOverride = overrides.chatProvider;
}

export function __resetCompositionForTests(): void {
  visionChainOverride = null;
  knowledgeRegistryOverride = null;
  reportSinkOverride = null;
  chatProviderOverride = null;
}
