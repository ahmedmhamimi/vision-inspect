/**
 * providers.ts
 * Centralizes environment-variable access for AI providers. No adapter reads
 * process.env directly — everything goes through this file, so there is exactly one
 * place to audit for "where do secrets get read" and exactly one place to change if a
 * variable name changes.
 *
 * - getGeminiApiKey(): reads GEMINI_API_KEY, throws a clear error if unset.
 * - getGroqApiKey(): reads GROQ_API_KEY, throws a clear error if unset.
 * - assertServerOnly(): a defensive check that throws if this module is somehow
 *   evaluated in a browser context — see the comment below for why that should be
 *   impossible by construction, and why the check exists anyway.
 */

/**
 * This file is only ever imported by files under lib/visioninspect/adapters/, which are
 * only ever imported by composition-root.ts, which is only ever imported by
 * app/api/visioninspect/route.ts — a Route Handler, which Next.js only executes on the
 * server. No component under src/components/ or src/app/**\/page.tsx imports anything
 * from this file or from the adapters. This assertion is a defense-in-depth backstop,
 * not the primary guarantee — the primary guarantee is that the import graph never gives
 * client code a path to reach this file at all.
 */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'providers.ts was evaluated in a browser context. This should be structurally ' +
        'impossible — see the comment above this function. If you are seeing this error, ' +
        'something imported an adapter from client code; fix the import, do not silence ' +
        'this check.',
    );
  }
}

export function getGeminiApiKey(): string {
  assertServerOnly();
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set. Copy .env.example to .env.local and add a real key ' +
        'from https://ai.google.dev/ before calling the Gemini adapter.',
    );
  }
  return key;
}

export function getGroqApiKey(): string {
  assertServerOnly();
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      'GROQ_API_KEY is not set. Copy .env.example to .env.local and add a real key from ' +
        'https://console.groq.com/ before calling the Groq fallback adapter.',
    );
  }
  return key;
}

export function getMaxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8 * 1024 * 1024; // 8MB default
}

export function getSupabaseUrl(): string {
  assertServerOnly();
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_URL is not set. Please add it to your environment variables.');
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  assertServerOnly();
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('SUPABASE_ANON_KEY is not set. Please add it to your environment variables.');
  }
  return key;
}
