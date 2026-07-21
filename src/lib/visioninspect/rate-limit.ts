/**
 * rate-limit.ts
 * A minimal in-memory rate limiter for the analysis endpoint, since every request there
 * costs real provider API money and an unthrottled endpoint is a cost-exhaustion vector,
 * not just a spam nuisance.
 *
 * ⚠️ SCOPE NOTE: this is an in-memory stub, correct for a single-instance deployment
 * (e.g. one long-running Node process) but NOT correct once an app runs across multiple
 * serverless function instances, which is exactly how Vercel scales Route Handlers under
 * load — each cold-started instance would get its own independent counter, so the real
 * effective limit could be far higher than configured. Before relying on this in a real
 * multi-instance production deployment, replace it with a shared store (e.g. Upstash
 * Redis, Vercel KV) behind the same checkRateLimit() function signature. Flagged again in
 * SETUP_AND_NEXT_STEPS.md and docs/security-checklist.md.
 *
 * - checkRateLimit(identifier): returns whether the request is allowed, and resets the
 *   window automatically once it expires.
 */
interface WindowState {
  count: number;
  windowStartedAt: number;
}

const state = new Map<string, WindowState>();

function getConfig() {
  const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '20', 10);
  const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
  return {
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 20,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const { maxRequests, windowMs } = getConfig();
  const now = Date.now();
  const existing = state.get(identifier);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    state.set(identifier, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - existing.windowStartedAt),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxRequests - existing.count, retryAfterMs: 0 };
}

/** Test-only helper to reset in-memory state between test cases. */
export function __resetRateLimitStateForTests(): void {
  state.clear();
}
