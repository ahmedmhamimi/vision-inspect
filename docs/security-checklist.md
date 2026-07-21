# Security Checklist — VisionInspect

Maps the project brief's five required security categories to what is actually
implemented in this codebase, with file references. Checked items were verified by
running the relevant test or command, not just asserted.

## 1. Server-only secrets

- [x] `GEMINI_API_KEY` and `GROQ_API_KEY` are read only in `src/lib/ai/providers.ts`,
      never inline in an adapter or component.
- [x] Neither key is ever prefixed `NEXT_PUBLIC_` — that prefix bundles a value into
      client JS. Verified by grep: `grep -r "NEXT_PUBLIC" src/` returns no matches
      referencing either key.
- [x] `assertServerOnly()` in `providers.ts` is a defense-in-depth check that throws if
      the module is somehow evaluated in a browser context — backstop, not the primary
      guarantee (the primary guarantee is the import graph: only adapters import this
      file, only `composition-root.ts` imports adapters, only `route.ts` imports the
      composition root).
- [x] `.env.example` documents every variable with no real values committed.
      `.gitignore` excludes `.env`, `.env.local`, and `.env.*.local`.
- [ ] **Team action required:** before pushing to GitHub, run
      `git log -p | grep -i "api_key\|GEMINI\|GROQ"` across the full history to confirm no
      real key was ever committed, even in an earlier commit that was later removed.

## 2. Input limits

- [x] Server-side file size limit (`MAX_UPLOAD_BYTES`, default 8MB), enforced in
      `validation.ts` before any provider call. Test:
      `tests/api/visioninspect.test.ts` → "rejects a file over the configured size
      limit and never calls the provider" — **passing**.
- [x] File type validated by content (magic bytes), not filename or client-claimed
      mime type. `validateImageUpload()` in `validation.ts`. Test: "rejects content
      that is not actually a JPEG/PNG/WebP, even with a valid claimed mime_type" —
      **passing**.
- [x] Rate limiting on the analysis endpoint (`rate-limit.ts`), keyed by
      `x-forwarded-for`. **Scope note:** this is an in-memory stub, correct for a
      single-instance deployment but not for Vercel's real multi-instance serverless
      scaling — see the warning at the top of `rate-limit.ts`. Replace with a shared
      store (Upstash Redis, Vercel KV) before relying on this in production.
- [x] A server-side timeout on both provider adapters (`ANALYSIS_TIMEOUT_MS` in each
      adapter) shorter than Vercel's platform function timeout, so the app controls the
      failure response instead of the platform silently killing the request.

## 3. Injection tests

- [x] 2 of the required 10 evaluation cases are prompt-injection scenarios — see
      `tests/evaluation/visioninspect-cases.json`, `INJECTION-01` (text-based) and
      `INJECTION-02` (image-embedded instruction, the VisionInspect-specific variant).
- [x] The Gemini adapter's system instruction explicitly tells the model to treat any
      instruction-like text visible in the image as untrusted content to describe, never
      as a command to obey — see `SYSTEM_INSTRUCTION` in `gemini-vision.adapter.ts`.
- [x] **The real backstop is architectural, not behavioral**: even if a model is fooled
      by an injected instruction, the resulting hypothesis still passes through
      `routeDefect()`'s deterministic rules and still requires a human to confirm before
      becoming final. `INJECTION-02`'s `expected_behavior` field states this directly —
      the test validates the backstop, not a claim of perfect model resistance.
- [ ] **Team action required:** the image-embedded scenario (`INJECTION-02`) needs a
      real adversarial test image, which cannot be generated as part of this scaffold.
      Produce one matching the description in the fixture and run it against the real
      Gemini adapter before submission.

## 4. Safe tool boundaries

- [x] `route_defect()` and `generate_inspection_report()` are pure functions in
      `tool-rules.ts` with zero AI SDK imports — verified by the fact that
      `tests/domain/tool-rules.test.ts` (13 tests) runs with zero network access and
      zero API keys.
- [x] The model is never given function-calling access to `generate_inspection_report()`
      or any storage-writing function. It only returns a JSON hypothesis; the
      application decides what to do with it.
- [x] Provider output is re-validated against `RawHypothesisSchema` server-side even
      though it came from a "structured output" API call — see the schema
      re-validation step in both `gemini-vision.adapter.ts` and
      `groq-fallback.adapter.ts`. Never trust that "we asked for JSON" means "we got
      valid JSON."
- [x] `generateInspectionReport()` re-validates `human_decision` at runtime in addition
      to the type system — see architecture.md "the one non-negotiable rule."

## 5. Safe errors

- [x] Every API error response is a short, generic, safe-to-display string —
      `safeErrorResponse()` in `route.ts`. Full error detail (including stack traces)
      goes only to `console.error`, which lands in server-side logs, never in the HTTP
      response body.
- [x] Distinct, correctly-mapped status codes per error type: 400 (validation /
      malformed request / missing reviewer note), 404 (record not found), 409
      (report requested for an unconfirmed record), 429 (rate limited), 502 (all
      providers failed), 500 (unexpected). Verified by the full status-code assertion
      in each API test.
- [x] Server logs never include the raw uploaded image or a full raw provider response
      — only the error object and context string.

## A real vulnerability found and fixed during this build

`npm install` flagged that the initially pinned `next@14.2.15` has a known, currently
disclosed vulnerability chain: [CVE-2025-55184](https://www.cve.org/CVERecord?id=CVE-2025-55184)
(High severity — Denial of Service via a crafted HTTP request to any App Router
endpoint) and [CVE-2025-55183](https://www.cve.org/CVERecord?id=CVE-2025-55183) (Medium
— Source Code Exposure), disclosed by the Next.js team on December 11, 2025. Both
directly affect App Router applications, which is this project's entire architecture.
Pinned version was bumped to `14.2.35`, the official patched release for the 14.x line
per [the advisory](https://nextjs.org/blog/security-update-2025-12-11), and a clean
reinstall confirmed the vulnerability warning no longer appears.

**Takeaway for the team:** run `npm install` and actually read its output before every
submission checkpoint — a real, disclosed, exploitable vulnerability was sitting in the
initial dependency pin here, and it would have shipped unnoticed without checking.

## Not covered by this checklist (out of scope per the project brief)

Final safety certification, medical-grade validation, and defenses against a
sophisticated adversary with white-box access to the model weights are explicitly out
of scope for this bounded, non-safety-critical educational/small-manufacturer pilot.
