# V3-8 — GLOBAL E2E / RELEASE CERTIFICATION

Status: `OPEN — authenticated run passed, release coverage incomplete`

## Run identity

- Baseline: `4595237`
- Branch: `codex/app-v3-mobile-first-redesign`
- QA project: `kpvvydthlxupjjqqdpxy`
- Production project: `wfxnwfcdjainpojhbdri` — prohibited
- Harness: `playwright.v3-release.config.mjs` + `tests/e2e/v3-release.spec.mjs`
- Browser: Playwright managed Chromium
- Successful command: `npx playwright test --config playwright.v3-release.config.mjs`
- Result: `5 passed (1.7m)`
- QA writes: `NONE` by harness design

The manual QA session was already authenticated by the user. No credentials,
tokens, cookies or auth metadata were requested, printed, copied or committed.
The harness default was corrected to the canonical metadata path produced by
`qa:auth:setup`: `.auth/costa-clean-storage-state.json`.

## Exact viewport evidence

The values below are taken from the successful private artifacts. Each row was
measured at the first inspected authenticated surface for that viewport.

| Requested | innerWidth | innerHeight | clientWidth | clientHeight | scrollWidth | scrollHeight | Root overflow observed |
|---|---:|---:|---:|---:|---:|---:|---|
| 390x844 | 390 | 844 | 390 | 844 | 390 | 1464 | PASS (`390 <= 390`) |
| 768x1024 | 768 | 1024 | 768 | 1024 | 768 | 1208 | PASS (`768 <= 768`) |
| 1280x800 | 1280 | 800 | 1280 | 800 | 1280 | 1033 | PASS (`1280 <= 1280`) |
| 1920x1080 | 1920 | 1080 | 1920 | 1080 | 1920 | 1270 | PASS (`1920 <= 1920`) |

Observed shell ownership was bottom navigation at `390x844` and `768x1024`,
and navigation rail at `1280x800` and `1920x1080`. The harness records these
values but does not assert them, so the Shell breakpoints row remains
`NOT CERTIFIED`.

## Release matrix

Only rows backed by successful Playwright assertions are marked `PASS`.

| Area | Result | Evidence/status |
|---|---|---|
| QA authentication | PASS | Authentication gate passed |
| QA backend / non-QA request guard | PASS | No guard violation recorded |
| Production request guard | PASS | No production request recorded |
| Home | PASS | Authenticated heading assertion at all four viewports |
| Clients | PASS | Authenticated heading assertion at all four viewports |
| Leads | PASS | Authenticated heading assertion at all four viewports |
| Properties | PASS | Authenticated heading assertion at all four viewports |
| Quotes | PASS | Authenticated heading assertion at all four viewports |
| Services | PASS | Authenticated heading assertion at all four viewports |
| Invoices | PASS | Authenticated heading assertion at all four viewports |
| Payments | PASS | Authenticated heading assertion at all four viewports |
| Expenses | PASS | Authenticated heading assertion at all four viewports |
| Alerts | PASS | Authenticated heading assertion at all four viewports |
| Closings | PASS | Authenticated heading assertion at all four viewports |
| More/navigation | PASS | Dialog and module labels asserted |
| Shell breakpoints | NOT CERTIFIED | Geometry recorded, not asserted |
| Hard reload session | NOT CERTIFIED | Reload is only exercised when a deep-link record is available |
| Client media | NOT CERTIFIED | Presentation recorded, not asserted |
| Recurring plans | NOT CERTIFIED | `recurringPlanSection=false` in all four artifacts |
| Deep links/back | NOT CERTIFIED | All eight deep-link probes reported `available=false` |
| Cross-module relations | NOT CERTIFIED | Client relation count recorded as `3`, not asserted; invoice/service unavailable |
| Loading/recovery | NOT CERTIFIED | No recovery path assertion in this harness |
| PWA/service worker | NOT CERTIFIED | Manifest/service-worker values recorded, not asserted |
| Accessibility | NOT CERTIFIED | No accessibility assertion in this harness |
| Reduced motion | NOT CERTIFIED | Reduced-motion context is created only for the mobile case; behavior is not asserted |

The release suite is read-only. It does not create fixtures or exercise
invoice, quote, payment, expense, storage, closing or alert writes. Earlier
write certifications remain authoritative and were intentionally not repeated.

## Zero-marker and runtime evidence

The artifacts observed the following values at every inspected surface and
viewport; the current harness records them but does not assert them:

- Legacy runtime markers: `0`
- Visible UUID: `0`
- Accessible UUID: `0`
- Unicode-as-icon: `0`
- `window.confirm`: `0`

Network/runtime counters were asserted for guard violations and page/console
errors. The successful run recorded, for each viewport:

- Production requests: `0`
- Non-QA Supabase violations: `0`
- Page errors: `0`
- Console errors: `0`
- Critical failed requests recorded: `0` (the harness does not fail on this counter)

QA DB and Storage deltas were not instrumented by this read-only suite. No QA
writes were issued, so no cleanup was run and no fresh fixtures were created.
The deltas therefore remain `NOT CERTIFIED`, rather than being presented as a
measured zero.

## Quality gates

The release suite itself passed after the path correction. The repository
quality gates must be rerun after this documentation update before any commit:

- Unit/integration tests: pending
- Lint: pending
- Build: pending
- Diff: pending
- Worktree: pending

## V3-9 prerequisites — not authorized

V3-9 must not start from this open gate. Before any controlled production
activation, all of the following require explicit authorization and review:

1. Explicit production activation authorization.
2. Review and application of the V3-7A production media migration.
3. Production environment verification.
4. Controlled deployment.
5. Production smoke certification.
6. Rollback plan.
7. Feature-flag activation decision.

No production deployment, SQL, migration, storage, auth mutation, DNS change,
feature-flag activation or production data change was performed here.

## Verdict

`V3-8 OPEN — authenticated Playwright run passed, but the release harness does not certify the required deep-link, relation, recurring-plan, accessibility, reduced-motion and QA-delta rows.`
