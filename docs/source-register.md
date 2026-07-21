# Source Register — VisionInspect

Every source the AI's domain claims are checked against must be logged here: URL/path,
date added, owner, and approval status. This is what the "Grounding, tools & AI
correctness" rubric criterion and Haneen's acceptance criteria ("every AI-generated
domain claim is checked against an original source") point back to.

**Status of this file:** template + sample entries only. The 20-30 real sample images
required by the project brief are not included — they cannot be produced as part of an
AI-generated scaffold. Haneen owns filling this in with real entries before any pilot use.

## How to log a new source

| Field | What goes here |
|---|---|
| ID | A short reference used elsewhere (e.g. in test fixture comments) |
| Type | `taxonomy`, `sop`, `sample-image` |
| Path/URL | Where it actually lives — a file path in this repo, or an external URL |
| Date added | When it was added to this register |
| Owner | Who added/approved it |
| Approval status | `draft`, `reviewed`, `approved` |
| Notes | Anything a reviewer needs to know |

## Current entries

| ID | Type | Path/URL | Date added | Owner | Approval status | Notes |
|---|---|---|---|---|---|---|
| SRC-001 | taxonomy | `knowledge/visioninspect/taxonomy.json` | scaffold build date | AI-generated scaffold | **draft — NOT approved** | Sample data, 10 defect categories, built so the app is runnable. Must be replaced with the team's real approved taxonomy before pilot use. |
| SRC-002 | sop | `knowledge/visioninspect/sop-register.md` | scaffold build date | AI-generated scaffold | **draft — NOT approved** | Sample SOP paired with SRC-001. Same replacement requirement. |

## Required before pilot use

- [ ] 20-30 real sample images logged here, each with a real path, a real defect (or
      confirmed no-defect) label, and a real owner who verified the label is correct
- [ ] The real taxonomy replacing `knowledge/visioninspect/taxonomy.json`, reviewed and
      approved by whoever the team designates as the domain authority for this pilot
      (course instructor, industry contact, or the team collectively — document who)
- [ ] The real SOP replacing `knowledge/visioninspect/sop-register.md`
- [ ] Each entry above moved from `draft` to `approved` only after actual review — do
      not mark something approved because it's the only option available under time
      pressure; an unreviewed source presented as approved is exactly the kind of gap
      the rubric's "fabricated sources" red flag is checking for

## Escalation

Any source Haneen is uncertain about — an image with an ambiguous label, a taxonomy
entry that doesn't clearly match the SOP, a defect type the approved corpus doesn't
cover — should be escalated per the project brief's instructor-escalation path before
being logged as `approved`. A `draft` entry left in the register at submission time is
safer than an `approved` entry that wasn't actually reviewed.
