# V3-10C5.1 — Shared operations hierarchy and status conventions

Status: `CLOSED / CERTIFIED`

Starting HEAD: `ad7e53796334fa447e34e1ec49a1bafbcddd3eb5`

## Exact authorized scope

C5.1 is the first bounded batch in the approved Operations plan. It establishes
one compact reading order for existing operational rows: identity, human
context, explicitly typed status, and the existing date or value. It keeps one
primary decision per existing flow and preserves the C1/C2 44px interaction
contract.

This is not C5.2 Services/Work Report, C5.3 Alerts composition, C5.4 Closings
composition or C5.5 Recurring Plans composition.

## Changes

- `V3EntityStatus` accepts an optional visible/accessibly named context, so an
  existing label such as `Pendiente` is now distinguishable as a service,
  billing, priority, lifecycle, plan, emission or preparation state without
  creating a new state value.
- `V3JobRow` uses only human-readable relation labels. When source data lacks
  one, it renders `Cliente sin identificar` or `Inmueble sin identificar`; raw
  database identifiers are not a fallback.
- Alerts render priority separately from decision state. Their action callbacks
  and the closed state machine are unchanged.
- Recurring rows render plan lifecycle separately from emission state. The
  cadence, due calculation, persistence, confirmation and generation controls
  are unchanged.
- Cierres labels readiness as preparation, preserving the deterministic source
  values, snapshot path, exports and assistive-AI boundary.
- Compact filter tabs now have `min-width: var(--v3-touch-min)` while retaining
  their intentional horizontal scroll container.

## Protected contracts

No service persistence, status transition, duplicate review, service-to-invoice
guard, Work Report output, alert decision action, `buildClosingSummary`,
recurring persistence, schedule helper, duplicate guard or recurring invoice
generation contract changed. There are no route, Supabase, schema, policy,
storage or business-data changes.

## Tests and static coverage

- `V3JobRow.test.ts` verifies the human-safe fallback and separate service/
  billing state labels.
- `V3AlertsPage.test.ts` verifies priority/lifecycle separation.
- `V3RecurringPlansPresentation.test.ts` verifies lifecycle/emission separation.
- `V3Primitives.test.ts` verifies contextual status accessibility.
- `v3CoreCorrections.test.ts` locks the filter tab 44px minimum geometry.

## Authenticated read-only QA

The canonical `costaclean-v3` QA profile was reused at
`http://127.0.0.1:4178/?v3=1`. No session artifact was read or printed.

| Surface | 320x568 | 390x844 | 768x1024 | 1440x900 |
| --- | --- | --- | --- | --- |
| Services list | PASS (empty) | PASS (empty) | PASS (empty) | PASS (empty) |
| Services workspace/Back/deep link | N/A — no QA row | N/A — no QA row | N/A — no QA row | N/A — no QA row |
| Alerts list and typed states | PASS | PASS | PASS | PASS |
| Alerts sheet Escape | PASS | PASS | PASS | PASS |
| Cierres readiness | PASS | PASS | PASS | PASS |
| Recurring rows | N/A — no plan for the available QA client | N/A | N/A | N/A |

Across inspected surfaces: page overflow, clipped non-scrollable content,
undersized visible controls, visible/accessibly named UUIDs, Unicode-as-icon,
legacy markers, broken assets, console errors, page errors and failed critical
requests were all `0`. Production requests and mutations were `0`; QA business
mutations were `0`. Screenshots and the sanitized runtime report are ignored
private evidence.

## Independent quality gate

The detached Windows `pr-quality-gate` reviewer independently inspected the
actual C5.1 diff, focused tests and full validation results. It reported P0–P3
as `0` within C5.1 and returned `PASS`. Its sanitized artifact is
`docs/V3-10C5-1_INDEPENDENT_REVIEW.md`.

## Remaining scope

C5 remains open. C5.2–C5.6 retain every module-specific finding assigned in
the preparation plan. No later C5 batch was started by this certification.
