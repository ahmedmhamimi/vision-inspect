# Architecture — VisionInspect

## Pattern: Hexagonal (Ports & Adapters)

The application core (domain layer) has no knowledge of how it is driven or what it
drives. It depends only on its own types and its own port interfaces — never on a
framework, an AI SDK, or a specific storage mechanism.

### Why hexagonal, not clean architecture or a modular monolith

- **Clean Architecture** (concentric layers: Domain → Application → Infrastructure →
  Presentation) is close, but heavier than a single-feature, one-pipeline app needs. It
  earns its cost on systems with many use cases; VisionInspect has one.
- **Modular monolith** answers "how do we divide many bounded contexts inside one
  deployable" — but this project has exactly one bounded context (inspection). The real
  problem here is isolating external dependencies (which AI provider, which storage),
  not dividing business capabilities.
- **Hexagonal** solves the two hard constraints this project actually has: (1) the vision
  provider must be swappable and must fail over (Gemini → Groq) without the domain layer
  knowing either exists, and (2) the deterministic routing/reporting logic must be
  testable with zero network calls and zero API keys. Three ports and their adapters
  deliver both directly.

## The one non-negotiable rule

> The AI model's output alone can never set a final inspection status. `human_decision`
> starts as `'pending'` and can only become `'confirmed'` or `'corrected'` through an
> explicit reviewer action. No inspection report can be generated until that happens.

This is enforced at three independent points, deliberately redundant:

1. **Type level** — `ConfirmedInspectionRecordSchema` (`schema.ts`) narrows
   `human_decision` to `'confirmed' | 'corrected'` and makes `confirmed_at` required.
2. **Runtime level** — `generateInspectionReport()` (`tool-rules.ts`) re-validates with
   `safeParse` and throws `UnconfirmedRecordError` if the check fails, even if the type
   system was bypassed upstream. This is intentional defense-in-depth: a test
   (`tests/domain/tool-rules.test.ts`) deliberately casts a pending record `as unknown as
   ConfirmedInspectionRecord` to prove the runtime guard is real, not just a TypeScript
   convenience.
3. **UI level** — `ConfirmationGate.tsx` is the only component wired to call the PATCH
   endpoint that changes `human_decision`. No other button, form, or code path in the
   client reaches that endpoint.

## Folder structure and ownership

```
src/
├── app/
│   ├── visioninspect/page.tsx                  [Asma]  — orchestrates the workflow
│   └── api/visioninspect/route.ts               [Shaza] — sole server boundary
│
├── components/
│   ├── visioninspect/
│   │   ├── InputForm.tsx                        [Asma]
│   │   ├── EvidencePanel.tsx                    [Asma]
│   │   ├── ConfirmationGate.tsx                  [Asma] — the human-gate component
│   │   ├── ResultView.tsx                       [Asma]
│   │   └── HistoryList.tsx                      [Asma]
│   └── common/
│       ├── LoadingState.tsx                     [Asma]
│       └── ErrorState.tsx                       [Asma]
│
└── lib/
    ├── ai/providers.ts                          [Shaza] — the only file reading secret env vars
    │
    └── visioninspect/
        ├── schema.ts                            [Shaza] — the 9-field structured contract
        ├── service.ts                           [Shaza] — orchestration, provider fallback
        ├── validation.ts                        [Shaza] — magic-byte file validation
        ├── rate-limit.ts                        [Shaza] — in-memory rate limiter
        │
        ├── taxonomy.ts                          [Haneen] — domain: taxonomy lookup, pure
        ├── tool-rules.ts                        [Haneen] — routeDefect(), generateInspectionReport()
        │
        ├── ports/
        │   ├── vision-analysis.port.ts          [Shaza]
        │   ├── knowledge-registry.port.ts        [Haneen]
        │   └── report-sink.port.ts              [Ahmed]
        │
        ├── adapters/
        │   ├── gemini-vision.adapter.ts          [Shaza]
        │   ├── groq-fallback.adapter.ts          [Shaza]
        │   ├── fake-vision.adapter.ts            [Shaza] — test-only, never used in production
        │   ├── taxonomy-registry.adapter.ts       [Haneen]
        │   └── report-storage.adapter.ts          [Ahmed]
        │
        └── composition-root.ts                  [Ahmed] — the ONE file wiring adapters to ports

knowledge/visioninspect/
├── taxonomy.json                                [Haneen] — SAMPLE DATA, replace before pilot use
└── sop-register.md                              [Haneen] — SAMPLE DATA, replace before pilot use

docs/
├── architecture.md                              [Ahmed] — this file
├── security-checklist.md                        [Ahmed + Haneen]
└── source-register.md                           [Haneen]

tests/
├── domain/tool-rules.test.ts                    [Haneen] — zero network, zero API keys
├── api/visioninspect.test.ts                    [Shaza]  — zero network, zero API keys
├── fixtures/visioninspect/                       [shared test infrastructure]
└── evaluation/visioninspect-cases.json           [Haneen] — the 10-case matrix
```

### Ownership rationale worth calling out explicitly

**`report-sink.port.ts` and `report-storage.adapter.ts` sit with Ahmed, not Haneen**,
even though report *generation* (`generateInspectionReport()`) is Haneen's domain logic.
Report *persistence* is an environment/deployment decision — file storage locally,
something else in production — and keeping that decision with the Integration Lead
means Haneen's domain code never needs to know about infrastructure choices made in a
later session. This is also why `report-storage.adapter.ts` carries the explicit warning
about Vercel's filesystem: that's exactly the kind of environment-specific knowledge
that belongs with the person who owns deployment, not buried in domain logic.

## The pipeline, stage by stage

1. **Upload** (`InputForm.tsx`) — client-side type/size checks for fast feedback. Not a
   security boundary; the real gate is server-side.
2. **Validate** (`route.ts` → `validation.ts`) — magic-byte content check, size limit,
   rate limit. Runs *before* any provider call. Proven by test: see "rejects content that
   is not actually a JPEG/PNG/WebP... and never calls the provider" in
   `tests/api/visioninspect.test.ts`.
3. **Analyze** (`service.ts` → `ports/vision-analysis.port.ts`) — tries Gemini first,
   falls over to Groq (degraded-confidence, text-only) on failure. Re-validates the
   provider's structured output against `RawHypothesisSchema` regardless of what the
   provider claims to have returned.
4. **Route** (`tool-rules.ts` → `routeDefect()`) — pure function: taxonomy lookup +
   crack-always-high policy override + confidence-based escalation. No I/O.
5. **Human gate** (`ConfirmationGate.tsx` → `route.ts` PATCH → `applyHumanDecision()`) —
   the only place `human_decision` changes. A `'corrected'` decision requires a non-empty
   `reviewer_note` — enforced by `MissingReviewerNoteError`, mapped to a 400 response.
6. **Report** (`generateInspectionReport()`) — only reachable for a genuinely confirmed
   record; see "the one non-negotiable rule" above.
7. **Persist** (`report-sink.port.ts` → `report-storage.adapter.ts`) — writes both the
   working record and, once generated, the report.

## What "swap an adapter" actually looks like

To replace file-based report storage with a real database before deploying:

1. Write `postgres-report.adapter.ts` implementing `ReportSinkPort` (4 methods:
   `saveReport`, `saveRecord`, `getRecord`, `listRecords`)
2. Change one line in `composition-root.ts`'s `getReportSink()`
3. Nothing in `service.ts`, `tool-rules.ts`, or any component changes

This is the concrete proof that the architecture is genuinely hexagonal and not just
folders named after the pattern — `composition-root.ts` is the artifact to walk through
during the individual defense to demonstrate it.
