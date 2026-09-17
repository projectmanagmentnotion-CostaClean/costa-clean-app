# V3-10C5.4 — Closings refinement

Status: `CLOSED / CERTIFIED`

Starting HEAD: `880ffbc2fe438c12eb5a1c1014af6112623d2379`

## Authoritative scope

C5.4 covers the V3 Closings surface (`fiscal_closing`) only. C5.5 Recurring
Plans and C5.6 cross-module runtime certification were not started.

The implementation is presentation/composition work. It does not alter the
closing calculation, persistence, export or AI business contracts.

## Findings addressed

- `O-C5-P1`: deterministic totals are explicitly labelled as calculated
  source data. Persisted snapshot state is displayed in a separate review
  section, and the assistive interpretation states that it does not
  recalculate amounts or replace professional review.
- `O-C5-P2`: the long page is divided into `Periodo activo`, `Resumen
  determinista`, `Estado del periodo y revisión`, `Incidencias`, `Snapshot
  interno` and `Salidas del periodo` sections. This keeps the period context,
  decision state and output actions scannable on mobile and desktop.
- `O-C5-P3`: export and AI output are separate articles with separate labels,
  copy and actions. Month/custom selections keep snapshot/AI actions disabled
  with contextual guidance.

## Implementation

Changed product/test files are limited to:

- `src/v3/closing/V3ClosingPage.tsx`: semantic separation of deterministic
  data, readiness, snapshot state, export and assistive output; existing
  handlers and contracts are preserved.
- `src/v3/design/v3.css`: Closings-only responsive grids and section/output
  presentation using the existing C2 semantic tokens and 44px control
  contract.
- `src/v3/closing/V3ClosingPage.test.ts`: focused tests for section
  separation, snapshot-status presentation, period-specific disabled actions,
  error semantics and technical-ID suppression.

## Protected contracts

Unchanged:

- `buildClosingSummary` and the deterministic summary engine.
- quarterly/annual snapshot persistence callbacks and existing snapshot
  mapping.
- incidence routing and the existing expense-review action.
- export package construction/download policy.
- `generateClosingIntelligenceSummary`; AI remains assistive only.
- Supabase schema/RPC/policies, routes/authentication and all other finance,
  services, alerts and recurring contracts.

No QA business mutation, production request or production mutation was made.
No fixture was created. The canonical authenticated QA profile was reused
without inspecting credentials, tokens or cookies.

## Authenticated read-only runtime evidence

QA URL: `http://127.0.0.1:4178/?v3=1`

QA namespace: `costaclean-v3`

The replay used the canonical profile and did not click save, export or AI
actions. Existing QA data rendered the current period with deterministic
totals, readiness/incidences and snapshot state visible.

| Viewport | Surface | Reload | Back | Overflow | UUID | Unicode | Legacy | Broken assets | Touch targets |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 320x568 | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px |
| 390x844 | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px |
| 768x1024 | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px |
| 1440x900 | PASS | PASS | PASS | 0 | 0 | 0 | 0 | 0 | >=44px |

The runtime audit also confirmed the deterministic summary marker, the
separate assistive boundary, snapshot-state copy and absence of a settlement
or other business confirmation action. Console errors, page errors and
failed critical requests were zero. Production requests and mutations were
zero; QA business mutations were zero.

The sanitized machine-readable replay summary is recorded in
`docs/V3-10C5-4_RUNTIME_EVIDENCE.md`; private screenshots remain ignored
under `qa-screenshots/private/c5-4-runtime/`.

## Validation

- Focused Closings tests: `7/7 PASS` (including the existing closing summary
  engine tests).
- Full tests: `858 passed / 4 skipped` with the standard `npm test` command.
- QA agents: `294/294 PASS`.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

The detached independent review passed with P0/P1/P2/P3 = `0/0/0/0` and is
recorded in `docs/V3-10C5-4_INDEPENDENT_REVIEW.md`.

## Remaining scope

`V3-10C5` remains open after C5.4 certification. C5.5 Recurring Plans and
C5.6 cross-module runtime and responsive certification remain not started.
