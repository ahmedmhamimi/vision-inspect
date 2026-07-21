# AGENTS.md

This is a **hexagonal architecture** (ports & adapters) app built with **Next.js 14 (App
Router) + TypeScript + Zod + Gemini/Groq**. It implements VisionInspect: a reviewer
uploads an inspection image, an AI provider proposes a defect hypothesis, deterministic
rules route it, and a human reviewer must confirm or correct it before a final report
can be generated.

## The one rule that overrides everything else

**No inspection report can be generated for a record whose `human_decision` is still
`'pending'`.** This is enforced in three places at once — don't remove any of them:

1. The `ConfirmedInspectionRecord` TypeScript type (`schema.ts`)
2. A runtime `safeParse` check inside `generateInspectionReport()` (`tool-rules.ts`)
3. The UI: `ConfirmationGate.tsx` is the only component that can trigger the PATCH
   request that changes `human_decision`

If you're adding a new way to reach "final report," it must still go through
`generateInspectionReport()` — do not add a second code path that generates a report
without that function's guard.

## Where things live

| To do this... | Edit this... |
|---|---|
| Change what fields the AI must return | `src/lib/visioninspect/schema.ts` |
| Change severity/routing rules | `src/lib/visioninspect/tool-rules.ts` (`routeDefect`) |
| Change the approved defect categories | `knowledge/visioninspect/taxonomy.json` |
| Add/change a Gemini or Groq prompt | `src/lib/visioninspect/adapters/gemini-vision.adapter.ts` or `groq-fallback.adapter.ts` |
| Add a new API endpoint | `src/app/api/visioninspect/route.ts` |
| Change validation rules (file size/type) | `src/lib/visioninspect/validation.ts` |
| Change what storage backend is used | `src/lib/visioninspect/adapters/report-storage.adapter.ts` + `composition-root.ts` |
| Add a new UI screen | `src/app/visioninspect/page.tsx` + `src/components/visioninspect/` |
| Wire a new adapter to a port | `src/lib/visioninspect/composition-root.ts` — this is the ONLY file that should do this |

## Rules for adding code here

- **Never import an AI SDK (`@google/genai`, `groq-sdk`) outside `src/lib/visioninspect/adapters/`.** The domain layer (`taxonomy.ts`, `tool-rules.ts`) must have zero knowledge that providers exist.
- **Never import an adapter directly from a component.** Components talk to `/api/visioninspect` over HTTP, never to a port or adapter directly.
- **Never read `process.env` for a secret outside `src/lib/ai/providers.ts`.** That file is the only place secrets get read from the environment.
- **Every new deterministic rule goes in `tool-rules.ts` as a pure function** — no `fetch`, no `fs`, no `Date.now()` inside the core routing logic itself (timestamps are fine at the boundaries, like `created_at`, but the actual severity/routing decision must be a pure function of its inputs so it stays unit-testable with zero mocking).
- **Run `npm test` after any change to `tool-rules.ts`, `schema.ts`, or `route.ts`.** These have the highest test coverage and the tests are fast (zero API keys, zero network).
- **Never widen a Zod schema to make a broken test pass.** If a test fails because test data doesn't match the schema, fix the test data — see `tests/domain/tool-rules.test.ts`'s git history for a real example of this exact mistake (non-UUID test IDs tripping the `ConfirmedInspectionRecordSchema`'s `uuid()` check).

## Running things

```bash
npm install
cp .env.example .env.local   # then add real GEMINI_API_KEY / GROQ_API_KEY
npm run dev                   # local dev server
npm test                      # domain + API tests, no API keys needed
npm run typecheck             # strict TypeScript check
npm run build                 # production build
```
