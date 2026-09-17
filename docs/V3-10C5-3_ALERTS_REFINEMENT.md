# V3-10C5.3 — Alerts refinement

Status: `CLOSED / CERTIFIED`

Starting HEAD: `fde881dd0b625a91e6153c4a483bf8e36b1cbd74`

## Authoritative scope

C5.3 covers the V3 Alerts list and detail sheet composition only. It does not
change alert generation, rule severity, decision state, global/user scope,
routing semantics or persistence. C5.4 Closings, C5.5 Recurring Plans and
C5.6 cross-module certification are not started.

## Findings addressed

- `O-C5-P2` priority hierarchy: the list now groups the existing
  `critical`, `action`, `follow_up` and `info` buckets in that order. The
  grouping is presentation-only and does not create a new severity or state.
- `O-C5-P2` detail action hierarchy: the existing rule-specific route is the
  single primary action. Read, acknowledge, dismiss and reopen remain
  secondary lifecycle actions and retain their existing handlers.
- `O-C5-P3` scan context: rows and the sheet expose existing age/context data
  and a human-readable area label where the routing payload supports it.
  No timestamp, status, severity or business field was invented.
- Empty reviewed filters now explain that resolved or dismissed items appear
  there when available.

## Implementation

Changed files are limited to:

- `src/v3/alerts/V3AlertsPage.tsx`: priority groups, status/context hierarchy,
  sheet action grouping, filter feedback and accessible row labels.
- `src/features/automation/alertPresentation.ts`: human-readable routing
  labels and corrected presentation accenting for the existing critical
  bucket.
- `src/v3/components/V3Primitives.tsx`: additive `ariaPressed` propagation
  for shared action semantics; no visual or business behavior change.
- `src/v3/design/v3.css`: Alerts-specific layout rules using existing
  semantic tokens and the existing 44px control contract.
- `src/v3/alerts/V3AlertsPage.test.ts` and
  `src/features/automation/alertPresentation.test.ts`: focused presentation,
  accessible-filter and human-safe-label coverage.

## Protected contracts

Unchanged: alert rule generation, `AlertDecisionStatus` values and
transitions (`open`, `acknowledged`, `resolved`, `dismissed`), global/user
decision scope, read/acknowledge/dismiss/reopen handlers, routing payloads,
Supabase/auth/routes, and all finance/operations business contracts. No QA
business mutation, schema change or production request was introduced.

## Authenticated read-only runtime evidence

QA URL: `http://127.0.0.1:4178/?v3=1`
QA namespace: `costaclean-v3`

The canonical authenticated QA profile was reused. The Alerts surface had four
existing rows at every viewport; no fixture or write was used.

| Viewport | List/filter replay | Detail sheet | Overflow | UUID | Unicode | Legacy | Broken assets |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 320x568 | PASS | PASS | 0 | 0 | 0 | 0 | 0 |
| 390x844 | PASS | PASS | 0 | 0 | 0 | 0 | 0 |
| 768x1024 | PASS | PASS | 0 | 0 | 0 | 0 | 0 |
| 1440x900 | PASS | PASS | 0 | 0 | 0 | 0 | 0 |

Filter replay covered Pendientes, Críticas, Revisadas and Todas. The
corresponding control hit areas measured 48px. The sheet had one full-width
primary route action, grouped secondary lifecycle actions, no undersized
controls, Escape close and focus restoration. Console errors, page errors and
failed critical requests were zero. Production requests and mutations were
zero; QA business mutations were zero.

## Validation

- Focused Alerts tests: `7/7 PASS`.
- Full tests: `853 passed / 4 skipped`.
- QA agents: `294/294 PASS`.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

The independent review is required before this document is treated as a
certification. It returned `PASS`; its sanitized result is recorded in
`docs/V3-10C5-3_INDEPENDENT_REVIEW.md`.

## Remaining scope

`V3-10C5` remains open. C5.4 Closings, C5.5 Recurring Plans and C5.6
cross-module certification remain not started. V3-10C3 remains open pending
its separate authenticated certification.
