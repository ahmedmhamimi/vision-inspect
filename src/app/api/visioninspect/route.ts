/**
 * route.ts
 * The sole server boundary for VisionInspect. No component, page, or other file calls
 * an AI SDK or reads process.env for a secret directly — everything funnels through
 * this Route Handler, which Next.js guarantees only ever executes server-side.
 *
 * - POST: validate → rate-limit → analyze + route → return the pending InspectionRecord.
 * - PATCH: apply a human decision, then auto-generate and persist the report for
 *   confirmed/corrected records.
 * - GET: fetch a single record by ?image_id=, or the recent history if omitted.
 *
 * Error handling follows docs/security-checklist.md "safe errors": every response the
 * client sees is a short, generic, safe-to-display message. Full detail (including the
 * original error object) goes only to console.error, which lands in Vercel's server-side
 * function logs — never in the HTTP response body.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ImageValidationError, validateImageUpload } from '@/lib/visioninspect/validation';
import { checkRateLimit } from '@/lib/visioninspect/rate-limit';
import {
  AnalysisUnavailableError,
  RecordNotFoundError,
  analyzeAndRoute,
  confirmInspection,
  generateAndSaveReport,
  listInspectionHistory,
  deleteInspection,
} from '@/lib/visioninspect/service';
import {
  MissingReviewerNoteError,
  UnconfirmedRecordError,
} from '@/lib/visioninspect/tool-rules';
import { AnalyzeRequestSchema, ConfirmRequestSchema } from '@/lib/visioninspect/schema';
import { getReportSink } from '@/lib/visioninspect/composition-root';
import { getCurrentUser, isAuthConfigured } from '@/lib/auth/session';

/** Returns a 401 response if Supabase auth is configured and nobody is signed in;
 *  otherwise null, meaning the caller should proceed. Mirrors middleware.ts's
 *  fail-open stance so local dev without Supabase env vars isn't locked out. This is
 *  the defense-in-depth check for the raw API endpoint — middleware.ts already blocks
 *  unauthenticated access to the /visioninspect *page*, but a request made directly
 *  against this route (curl, another client) bypasses page-level middleware routing
 *  for nothing except the matcher's path prefixes, so the route itself checks too. */
async function requireApiAuth(): Promise<NextResponse | null> {
  if (!isAuthConfigured()) return null;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  return null;
}

function clientIdentifier(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Logs full error detail server-side only, returns a safe generic message + status. */
function safeErrorResponse(err: unknown, context: string): NextResponse {
  console.error(`[visioninspect:${context}]`, err);

  if (err instanceof ImageValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof MissingReviewerNoteError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'The request body did not match the expected shape.' },
      { status: 400 },
    );
  }
  if (err instanceof RecordNotFoundError) {
    return NextResponse.json({ error: 'No inspection found for that image.' }, { status: 404 });
  }
  if (err instanceof UnconfirmedRecordError) {
    return NextResponse.json(
      { error: 'This inspection has not been confirmed by a reviewer yet.' },
      { status: 409 },
    );
  }
  if (err instanceof AnalysisUnavailableError) {
    return NextResponse.json(
      { error: 'Image analysis is temporarily unavailable. Please try again shortly.' },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { error: 'Something went wrong processing your request. Please try again.' },
    { status: 500 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireApiAuth();
  if (authError) return authError;

  const identifier = clientIdentifier(request);
  const rateLimit = checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many analysis requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const parsedRequest = AnalyzeRequestSchema.parse(body);

    const buffer = Buffer.from(parsedRequest.image_base64, 'base64');
    const validated = validateImageUpload(buffer, parsedRequest.mime_type);

    // requireApiAuth() above already confirmed there's a session whenever auth is
    // configured; this just re-reads it to get the id to stamp onto the record. When
    // auth isn't configured this is undefined and the record is simply saved without an
    // owner — analyzeAndRoute/schema.ts both treat created_by as optional.
    const user = await getCurrentUser().catch(() => null);

    const record = await analyzeAndRoute(
      {
        imageBuffer: validated.buffer,
        mimeType: validated.mimeType,
      },
      user?.id,
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return safeErrorResponse(err, 'POST');
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = await requireApiAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const decision = ConfirmRequestSchema.parse(body);

    const updatedRecord = await confirmInspection(decision.image_id, decision);
    const report = await generateAndSaveReport(decision.image_id);

    return NextResponse.json({ record: updatedRecord, report }, { status: 200 });
  } catch (err) {
    return safeErrorResponse(err, 'PATCH');
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireApiAuth();
  if (authError) return authError;

  try {
    const imageId = request.nextUrl.searchParams.get('image_id');

    if (imageId) {
      const record = await getReportSink().getRecord(imageId);
      if (!record) {
        throw new RecordNotFoundError(imageId);
      }
      return NextResponse.json({ record }, { status: 200 });
    }

    const history = await listInspectionHistory(50);
    return NextResponse.json({ records: history }, { status: 200 });
  } catch (err) {
    return safeErrorResponse(err, 'GET');
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authError = await requireApiAuth();
  if (authError) return authError;

  try {
    const imageId = request.nextUrl.searchParams.get('image_id');
    if (!imageId) {
      return NextResponse.json({ error: 'Missing image_id parameter' }, { status: 400 });
    }

    await deleteInspection(imageId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return safeErrorResponse(err, 'DELETE');
  }
}
