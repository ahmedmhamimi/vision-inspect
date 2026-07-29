/**
 * route.ts (/api/visioninspect/chat)
 * The server boundary for the per-image chat feature. Like the parent /api/visioninspect
 * route, this is the only place allowed to call into service.ts for this feature — no
 * component reads GEMINI_API_KEY or imports an adapter directly.
 *
 * Statelessness is the whole point here: this handler does not read or write any chat
 * history anywhere. The client sends the entire prior transcript with every request (see
 * ChatModal.tsx) and the response is a single reply string — nothing about the
 * conversation is ever written to the report sink, a database, or disk. Restarting the
 * server, refreshing the page, or closing the chat panel all lose the conversation, by
 * design (see docs referenced in ChatMessage's comment in schema.ts).
 *
 * - POST: validate → rate-limit → look up the record being discussed → ask the chat
 *   provider for a reply → return it. Never persists anything new.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { checkRateLimit } from '@/lib/visioninspect/rate-limit';
import { ChatRequestSchema } from '@/lib/visioninspect/schema';
import {
  ChatUnavailableError,
  RecordNotFoundError,
  chatAboutInspection,
} from '@/lib/visioninspect/service';

function clientIdentifier(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Same "safe errors" stance as the parent route: full detail to console.error only,
 *  a short generic message in the response body. */
function safeErrorResponse(err: unknown, context: string): NextResponse {
  console.error(`[visioninspect:chat:${context}]`, err);

  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'The request body did not match the expected shape.' },
      { status: 400 },
    );
  }
  if (err instanceof RecordNotFoundError) {
    return NextResponse.json({ error: 'No inspection found for that image.' }, { status: 404 });
  }
  if (err instanceof ChatUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  return NextResponse.json(
    { error: 'Something went wrong answering that. Please try again.' },
    { status: 500 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const identifier = clientIdentifier(request);
  // A distinct bucket from the analyze endpoint's rate limit (same function, different
  // key) — chatting about an image and re-analyzing one are different cost profiles and
  // shouldn't share a counter.
  const rateLimit = checkRateLimit(`chat:${identifier}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many chat messages. Please wait a moment before sending another.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.parse(body);

    const reply = await chatAboutInspection(parsed.image_id, parsed.history, parsed.message);

    return NextResponse.json({ reply }, { status: 200 });
  } catch (err) {
    return safeErrorResponse(err, 'POST');
  }
}
