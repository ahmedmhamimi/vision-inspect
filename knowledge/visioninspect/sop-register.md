# Sample Inspection SOP — SOP-VI-01

> **SAMPLE DATA NOTICE:** This is a placeholder Standard Operating Procedure created so
> VisionInspect is runnable and testable end to end. It is not an approved inspection
> standard. Team 06 must replace this with the real bounded, approved SOP referenced in
> the project brief before any real pilot use, and record it in `docs/source-register.md`
> with a real owner, approval date, and access record.

## Scope

This SOP covers **non-safety-critical visual inspection** of a single bounded product
category, as required by the project's "First Pilot" definition. It explicitly excludes:

- Final safety certification
- Medical diagnosis
- Surveillance use cases
- Autonomous rejection of real products — every rejection requires human confirmation

## Defect categories

See `knowledge/visioninspect/taxonomy.json` for the full structured taxonomy. Ten
categories are defined, covering the visible defect classes most relevant to a bounded
educational-lab or small-manufacturer pilot: surface scratches, dents, discoloration,
cracks, missing components, misalignment, contamination, label defects, dimensional
deviation, and the explicit "no defect detected" case.

## Severity policy

Severity is assigned by **deterministic rule**, using the AI's visible-evidence
description as input, never by the AI's own severity opinion alone. This is implemented
in `src/lib/visioninspect/tool-rules.ts` → `route_defect()`.

Two policy rules apply regardless of the specific defect type:

1. **Cracks are always high severity.** A confirmed crack is treated as high severity
   regardless of apparent size, since hairline cracks can propagate under load.
2. **Low AI confidence forces escalation.** Any hypothesis below the confidence threshold
   defined in `taxonomy.json` (`confidence_escalation_threshold`) is routed to
   `escalate-to-senior-reviewer` regardless of what its default severity mapping would
   otherwise produce. The system treats "the AI is not sure" as a routing signal in its
   own right, not just something to display quietly in a confidence badge.

## Human confirmation requirement

No inspection reaches final status without an explicit reviewer action. The reviewer
sees:

- The AI's stated visible evidence and confidence
- The deterministic severity and recommended action
- The taxonomy reference the routing decision was based on

The reviewer must choose **Confirm** (accept the AI hypothesis and deterministic routing
as correct) or **Correct** (override the severity and/or recommended action, with a
required note explaining why). Only after this choice is recorded does
`generate_inspection_report()` become callable for that record — this is enforced by the
type system (`ConfirmedInspectionRecordSchema` in `schema.ts`) as well as at runtime.

## Escalation

Any inspection the reviewer is uncertain about, any source the reviewer finds
questionable, and any request that would expand this SOP's bounded scope should be
escalated to the project's Knowledge, Tools & Quality owner before being treated as
approved guidance — see the project brief's "Instructor escalation" rules for the
broader course-level escalation path.
