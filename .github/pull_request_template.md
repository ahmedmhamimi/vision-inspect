## What this PR does

<!-- One sentence. If you need more than one sentence, this PR is probably too big. -->

## Which owned area does this touch?

- [ ] Integration / architecture (Ahmed)
- [ ] AI & Backend (Shaza)
- [ ] Product UI & Workflow (Asma)
- [ ] Knowledge, Tools & Quality (Haneen)

## Pre-merge checklist

- [ ] `npm run typecheck` passes locally
- [ ] `npm run lint` passes locally
- [ ] `npm test` passes locally
- [ ] If this touches `tool-rules.ts` or `schema.ts`: added/updated a test in
      `tests/domain/tool-rules.test.ts`
- [ ] If this touches `route.ts`: added/updated a test in `tests/api/visioninspect.test.ts`
- [ ] No secret values (API keys, tokens) appear anywhere in the diff
- [ ] No `NEXT_PUBLIC_`-prefixed variable was added for anything secret
- [ ] If this changes a port interface (`ports/*.port.ts`): confirmed with Ahmed first —
      these are the frozen contracts other members' code depends on

## Anything the reviewer should know?

<!-- Known limitations, follow-up needed, things you're unsure about. -->
