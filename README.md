# VisionInspect

An AI visual quality inspection workflow. A reviewer uploads an inspection image; an AI
provider proposes a defect hypothesis with stated evidence and confidence; a deterministic
rules engine applies severity and routing; a human reviewer must explicitly **confirm or
correct** the finding before any final inspection report can be generated.

**Team 06 — VisionInspect** · AI in Applications course project

## Who this is for

Educational labs and small manufacturers running a bounded, non-safety-critical visual
inspection pilot. This is explicitly **not** built for final safety certification, medical
diagnosis, surveillance, or autonomous rejection of real products — a human always makes
the final call. See `docs/architecture.md` for the full scope statement.

## Quick start

```bash
git clone <this-repo>
cd visioninspect
npm install
cp .env.example .env.local
# Edit .env.local and add real GEMINI_API_KEY and GROQ_API_KEY values
npm run dev
```

Open http://localhost:3000 — it redirects straight to the inspection workflow.

## Running the test suite

```bash
npm test          # runs once
npm run test:watch  # re-runs on file change
```

The full suite (25 tests across the domain layer and the API layer) runs with **zero API
keys configured** — every test injects a fake vision-analysis adapter instead of calling
Gemini or Groq. This is verified, not assumed: see "What has actually been verified"
below.

## What has actually been verified

This project was scaffolded with AI assistance (see `AI_USAGE.md`). Before being handed
off, the following was **actually executed**, not just claimed:

| Check | Command | Result |
|---|---|---|
| Strict TypeScript compile | `npx tsc --noEmit` | ✅ 0 errors |
| ESLint (`next/core-web-vitals`) | `npx eslint src` | ✅ 0 errors/warnings |
| Full test suite | `npx vitest run` | ✅ 25/25 passing |
| Production build | `npm run build` | ✅ compiles and generates all routes |
| Placeholder/TODO sweep | `grep -r "TODO\|PLACEHOLDER..."` | ✅ none found in source or tests |
| Dependency security check | `npm install` output | ✅ `next` pinned to `14.2.35`, the patched release for [CVE-2025-55184 / CVE-2025-55183 / CVE-2025-67779](https://nextjs.org/blog/security-update-2025-12-11) (a real App Router DoS + source-code-exposure vulnerability chain disclosed Dec 2025 — this project uses App Router directly, so this was not optional) |

What was **not** verified, because it genuinely can't be from this environment — see
`SETUP_AND_NEXT_STEPS.md` for the full list and why each one requires a human with real
credentials:

- A real call to the Gemini or Groq API (no API key was available at build time)
- A real Vercel deployment
- Real adversarial test images for the prompt-injection evaluation cases

## Architecture

Hexagonal (ports & adapters). Full rationale in `docs/architecture.md`; summary:

```
src/
├── app/
│   ├── visioninspect/page.tsx        UI — orchestrates the workflow
│   └── api/visioninspect/route.ts    the ONLY server boundary
├── components/visioninspect/         InputForm, EvidencePanel, ConfirmationGate, ResultView, HistoryList
└── lib/
    ├── ai/providers.ts               env var access, nowhere else
    └── visioninspect/
        ├── schema.ts                 the 9-field structured-output contract (Zod)
        ├── taxonomy.ts, tool-rules.ts   DOMAIN — pure functions, zero I/O
        ├── ports/                    3 interfaces: vision-analysis, knowledge-registry, report-sink
        ├── adapters/                 Gemini, Groq fallback, taxonomy file reader, report file storage
        ├── composition-root.ts       the ONE place adapters get wired to ports
        └── service.ts                orchestrates: validate → analyze → route → persist
```

**The rule this structure exists to enforce:** the domain layer (`taxonomy.ts`,
`tool-rules.ts`) never imports an AI SDK. Swap Gemini for a different provider by writing
one new adapter and changing one line in `composition-root.ts` — nothing else changes.

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Primary vision-analysis provider |
| `GROQ_API_KEY` | Yes | Fallback provider (text-only, degraded-confidence path) |
| `MAX_UPLOAD_BYTES` | No (defaults to 8MB) | Server-side upload size ceiling |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` | No | In-memory rate limit on the analysis endpoint |
| `REPORT_STORAGE_DIR` | No (defaults to `.data/reports`) | Where confirmed reports are written locally |

**None of these are ever prefixed with `NEXT_PUBLIC_`.** That prefix would bundle them
into client-side JavaScript. See `docs/security-checklist.md`.

## Known limitations (read before deploying)

1. **The file-based report storage adapter will not persist data on Vercel.** Vercel's
   serverless filesystem is read-only outside `/tmp`, and `/tmp` isn't persistent across
   invocations. This adapter is correct for local development only — swap it for a real
   database/object-store adapter before deploying. See the comment at the top of
   `report-storage.adapter.ts`.
2. **The rate limiter is in-memory and per-instance.** On Vercel, each serverless
   instance gets its own counter, so the effective limit is higher than configured under
   real multi-instance load. See `rate-limit.ts`.
3. **The Gemini and Groq adapters have not been executed against live APIs.** They were
   written against the documented SDK shapes but no API key was available in this build
   environment. Verify against a real key and a real sample image before relying on them.
4. **The approved taxonomy and SOP are sample/placeholder data**, built so the app is
   runnable end to end. Replace `knowledge/visioninspect/taxonomy.json` and
   `knowledge/visioninspect/sop-register.md` with the team's real approved corpus — see
   `docs/source-register.md`.

## Team

| Name | Role | Owns |
|---|---|---|
| Ahmed Mohamed Hamimi Abdullah | Integration Lead / Solution Architect | `composition-root.ts`, `docs/`, deployment |
| Shaza Mohamed Bashir | AI & Backend Engineer | `route.ts`, `service.ts`, `schema.ts`, AI adapters |
| Asma Raafat Abdalsalam | Product UI & Workflow Engineer | `app/visioninspect/`, all `components/visioninspect/` |
| Ali Hamdi | Knowledge, Tools & Quality Engineer | `taxonomy.ts`, `tool-rules.ts`, `knowledge/`, tests |

Full ownership breakdown in `docs/architecture.md`.
