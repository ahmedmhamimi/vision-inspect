/**
 * visioninspect.test.ts
 * API-level tests for the Route Handler. Every test in this file injects fakes via
 * __setCompositionForTests — no real GEMINI_API_KEY or GROQ_API_KEY is read, and no real
 * file is written to disk. This mirrors exactly how `npm test` is expected to run in a
 * fresh clone before anyone has configured .env.local.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, POST } from '@/app/api/visioninspect/route';
import {
  __resetCompositionForTests,
  __setCompositionForTests,
} from '@/lib/visioninspect/composition-root';
import { FakeVisionAdapter, makeHypothesis } from '@/lib/visioninspect/adapters/fake-vision.adapter';
import { TaxonomyRegistryAdapter } from '@/lib/visioninspect/adapters/taxonomy-registry.adapter';
import { InMemoryReportSink } from '../fixtures/visioninspect/in-memory-report-sink';
import { CountingVisionAdapter } from '../fixtures/visioninspect/counting-vision-adapter';
import { __resetRateLimitStateForTests } from '@/lib/visioninspect/rate-limit';

const VALID_JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xdb]); // enough bytes to pass magic-byte detection
const FAKE_JPEG_BASE64 = Buffer.concat([
  VALID_JPEG_HEADER,
  Buffer.from('fake-jpeg-body-content-for-testing-purposes'),
]).toString('base64');

function makeRequest(method: 'POST' | 'PATCH' | 'GET', body?: unknown, url = 'http://localhost/api/visioninspect') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/visioninspect', () => {
  let reportSink: InMemoryReportSink;
  let countingAdapter: CountingVisionAdapter;

  beforeEach(() => {
    __resetCompositionForTests();
    __resetRateLimitStateForTests();
    reportSink = new InMemoryReportSink();
    countingAdapter = new CountingVisionAdapter(new FakeVisionAdapter());
    __setCompositionForTests({
      visionChain: [countingAdapter],
      knowledgeRegistry: new TaxonomyRegistryAdapter(),
      reportSink,
    });
  });

  it('returns a routed, pending record for a valid image', async () => {
    const res = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/jpeg' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.record.human_decision).toBe('pending');
    expect(body.record.severity).toBeDefined();
    expect(countingAdapter.callCount).toBe(1);
  });

  it('rejects a malformed request body with 400 and never calls the provider', async () => {
    const res = await POST(makeRequest('POST', { image_base64: '', mime_type: 'image/jpeg' }));
    expect(res.status).toBe(400);
    expect(countingAdapter.callCount).toBe(0);
  });

  it('rejects content that is not actually a JPEG/PNG/WebP, even with a valid claimed mime_type, and never calls the provider', async () => {
    const notAnImage = Buffer.from('this is just plain text, not image bytes').toString('base64');
    const res = await POST(
      makeRequest('POST', { image_base64: notAnImage, mime_type: 'image/jpeg' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not appear to be/i);
    expect(countingAdapter.callCount).toBe(0);
  });

  it('rejects an unsupported mime_type at the schema level before touching validation or the provider', async () => {
    const res = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/gif' }),
    );
    expect(res.status).toBe(400);
    expect(countingAdapter.callCount).toBe(0);
  });

  it('falls back to the next provider in the chain when the first one fails, and still returns a usable record', async () => {
    const failingPrimary = new CountingVisionAdapter(
      new FakeVisionAdapter({ mode: 'error', message: 'Simulated Gemini outage' }),
    );
    const workingFallback = new CountingVisionAdapter(
      new FakeVisionAdapter({
        mode: 'success',
        hypothesis: makeHypothesis({ degraded: true, degraded_reason: 'fallback used' }),
      }),
    );
    __setCompositionForTests({
      visionChain: [failingPrimary, workingFallback],
      knowledgeRegistry: new TaxonomyRegistryAdapter(),
      reportSink,
    });

    const res = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/jpeg' }),
    );
    expect(res.status).toBe(201);
    expect(failingPrimary.callCount).toBe(1);
    expect(workingFallback.callCount).toBe(1);
    const body = await res.json();
    expect(body.record.degraded).toBe(true);
  });

  it('returns 502 when every provider in the chain fails', async () => {
    __setCompositionForTests({
      visionChain: [
        new FakeVisionAdapter({ mode: 'error', message: 'Gemini down' }),
        new FakeVisionAdapter({ mode: 'error', message: 'Groq down' }),
      ],
      knowledgeRegistry: new TaxonomyRegistryAdapter(),
      reportSink,
    });

    const res = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/jpeg' }),
    );
    expect(res.status).toBe(502);
  });

  it('rejects a file over the configured size limit and never calls the provider', async () => {
    const oversized = Buffer.concat([VALID_JPEG_HEADER, Buffer.alloc(9 * 1024 * 1024, 1)]);
    const res = await POST(
      makeRequest('POST', {
        image_base64: oversized.toString('base64'),
        mime_type: 'image/jpeg',
      }),
    );
    expect(res.status).toBe(400);
    expect(countingAdapter.callCount).toBe(0);
  });
});

describe('PATCH /api/visioninspect (confirmation gate)', () => {
  let reportSink: InMemoryReportSink;

  beforeEach(async () => {
    __resetCompositionForTests();
    __resetRateLimitStateForTests();
    reportSink = new InMemoryReportSink();
    __setCompositionForTests({
      visionChain: [new FakeVisionAdapter()],
      knowledgeRegistry: new TaxonomyRegistryAdapter(),
      reportSink,
    });
  });

  it('confirms a pending record and generates a report in one call', async () => {
    const analyzeRes = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/jpeg' }),
    );
    const { record } = await analyzeRes.json();

    const confirmRes = await PATCH(
      makeRequest('PATCH', { image_id: record.image_id, decision: 'confirmed' }),
    );
    expect(confirmRes.status).toBe(200);
    const body = await confirmRes.json();
    expect(body.record.human_decision).toBe('confirmed');
    expect(body.report.human_sign_off.decision).toBe('confirmed');
  });

  it('returns 404 when confirming a record that does not exist', async () => {
    const res = await PATCH(
      makeRequest('PATCH', {
        image_id: '00000000-0000-4000-8000-000000000000',
        decision: 'confirmed',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('rejects a correction with no reviewer_note', async () => {
    const analyzeRes = await POST(
      makeRequest('POST', { image_base64: FAKE_JPEG_BASE64, mime_type: 'image/jpeg' }),
    );
    const { record } = await analyzeRes.json();

    const res = await PATCH(
      makeRequest('PATCH', {
        image_id: record.image_id,
        decision: 'corrected',
        corrected_severity: 'high',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/visioninspect', () => {
  beforeEach(() => {
    __resetCompositionForTests();
    __resetRateLimitStateForTests();
    __setCompositionForTests({
      visionChain: [new FakeVisionAdapter()],
      knowledgeRegistry: new TaxonomyRegistryAdapter(),
      reportSink: new InMemoryReportSink(),
    });
  });

  it('returns an empty history list when nothing has been analyzed yet', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.records).toEqual([]);
  });

  it('returns 404 for a specific image_id that does not exist', async () => {
    const res = await GET(
      makeRequest('GET', undefined, 'http://localhost/api/visioninspect?image_id=00000000-0000-4000-8000-000000000000'),
    );
    expect(res.status).toBe(404);
  });
});
