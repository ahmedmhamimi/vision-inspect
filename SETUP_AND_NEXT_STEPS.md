# Setup and Next Steps — Read This Before Submitting

This project was scaffolded with AI assistance. Everything in the checklist below is a
real gap — not boilerplate caution — that requires a human on the team to close before
this is a finished, submittable, or deployable project. Each item says *why* it can't be
closed by AI alone.

## 1. Add real API keys

```bash
cp .env.example .env.local
```

Then add real values for `GEMINI_API_KEY` (from https://ai.google.dev/) and
`GROQ_API_KEY` (from https://console.groq.com/). **No AI assistant can obtain these for
you** — they require a human to create an account and accept the provider's terms.

## 2. Verify the AI adapters against a real API call

**Update: this has partially happened already.** Live testing caught a real bug — the
Gemini adapter was hardcoded to `gemini-2.0-flash`, a model Google fully shut down on
June 1, 2026. Every request was silently falling back to Groq (0% confidence, identical
"unavailable" result for every image) with no visible error, since only a total-chain
failure was being logged. This has been fixed: the model is updated to `gemini-2.5-flash`,
and every individual provider failure now logs to the server console, not just total
failure.

**Still needed:**

1. Re-run a real inspection with real keys and confirm you now get an actual Gemini
   analysis (varying results per image, non-zero confidence, no "degraded" banner) rather
   than the same fallback response every time
2. Watch your terminal/server logs while doing this — any `[visioninspect:analyzeAndRoute]`
   error means a provider is still failing, and the log line will tell you which one and
   why
3. If you still see the Groq fallback, the likely causes are: `GEMINI_API_KEY` not set
   or invalid, the key's Google Cloud project not having the Gemini API enabled, or a
   quota/billing issue — the server log will show the actual error message from Google,
   not just "unavailable"
4. Once real Gemini responses are confirmed working, check that the response actually
   matches what `EvidencePanel.tsx` expects to render
5. Google deprecates Gemini models on a rolling schedule — check
   https://ai.google.dev/gemini-api/docs/deprecations periodically and don't assume a
   model name that works today will keep working indefinitely
6. **Shaza owns this step** — she's the AI & Backend Engineer, and this is exactly the
   kind of "does the code actually do what it claims" verification an AI-generated
   scaffold cannot self-certify

## 3. Deploy to Vercel — and fix two things first

Deployment itself is a manual step (connect the repo, set environment variables in
Vercel's dashboard, deploy) — no AI assistant has Vercel account access to do this. Two
things in the current code will not work correctly on Vercel without changes first:

- **Report storage will not persist.** `report-storage.adapter.ts` writes to the local
  filesystem, which is correct for `npm run dev` but Vercel's serverless functions have
  a read-only filesystem outside `/tmp`, and `/tmp` doesn't persist across invocations.
  Replace this adapter with one backed by a real database or object store (Vercel
  Postgres, Vercel Blob, Upstash) before deploying — see the warning comment at the top
  of that file. The `ReportSinkPort` interface means this is a contained, one-file
  change.
- **The rate limiter resets per instance.** The in-memory counter in `rate-limit.ts`
  doesn't share state across Vercel's serverless instances, so the real effective limit
  under load is higher than `RATE_LIMIT_MAX_REQUESTS` suggests. Fine for a demo; replace
  with a shared store before any real multi-instance production use.
- Also set environment variables scope correctly: decide whether Vercel Preview
  deployments get the same API keys as Production, since every preview URL is a live,
  potentially-undiscovered copy of the app if they do — see the earlier security
  discussion in this project's planning notes.

**Ahmed owns this step** — deployment and environment configuration are explicitly his
role.

## 4. Replace the placeholder taxonomy and SOP

`knowledge/visioninspect/taxonomy.json` and `knowledge/visioninspect/sop-register.md` are
sample data, built so the app is runnable end to end — they are not an approved
inspection standard for any real product category. Replace them with the team's real,
reviewed taxonomy and SOP before any pilot use. See `docs/source-register.md` for the
required format and the approval workflow.

**Ali owns this step.**

## 5. Produce real evaluation and test images

`tests/evaluation/visioninspect-cases.json` documents the required 10-case evaluation
matrix, but several cases (especially `INJECTION-02`, the image-embedded prompt
injection) describe what the test image needs to contain in text — a real adversarial
image cannot be generated as part of this scaffold. Produce real images matching each
`expected_image_description` and record actual observed model behavior, not just the
expected behavior this fixture currently documents.

**Ali owns this step.**

## 6. The individual defense — this is the one AI genuinely cannot do for you

The project's grading rubric includes an individual defense where each member explains
and can modify their own assigned code live, and explicitly lists "member cannot explain
assigned work" as an automatic red flag. **A fully AI-generated codebase the team hasn't
personally read and understood is a real risk here, independent of how correct the code
is.**

Before submission, each team member should:

- Read every file listed under their name in `docs/architecture.md`'s ownership table
- Be able to explain, without looking, what their files do and why they're structured
  the way they are
- Actually modify something small in their area (change a copy string, add a test case,
  adjust a validation rule) to build real familiarity, not just read-through familiarity
- Flag anything they don't understand to the person more familiar with that layer
  *before* the review, not during it

This scaffold is a real, working starting point — not a substitute for the team actually
knowing their own project.

## Summary table

| Item | Owner | Blocking for |
|---|---|---|
| Real API keys | Whole team | Everything else |
| Verify adapters against live APIs | Shaza | Functional completeness |
| Fix report storage for Vercel | Ahmed | Deployment |
| Fix rate limiter for production scale | Ahmed | Production readiness (not the demo) |
| Deploy to Vercel | Ahmed | Deployment & ops rubric criterion |
| Replace taxonomy/SOP | Ali | Grounding rubric criterion, real pilot use |
| Real evaluation/injection test images | Ali | Reliability & security rubric criteria |
| Personal familiarity with own code | Everyone | Individual defense — 5 pts and a red-flag gate |