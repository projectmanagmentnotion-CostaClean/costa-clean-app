# V3-8 — GLOBAL E2E / RELEASE CERTIFICATION

Status: `V3-8 CLOSED / CERTIFIED`

## Run identity

- Baseline: `4595237`
- Branch: `codex/app-v3-mobile-first-redesign`
- QA project: `kpvvydthlxupjjqqdpxy`
- Production project: `wfxnwfcdjainpojhbdri` — prohibited
- Harness: `playwright.v3-release.config.mjs` + `tests/e2e/v3-release.spec.mjs`
- Browser: Playwright managed Chromium
- Command: `npx playwright test --config playwright.v3-release.config.mjs`
- Result: `5 passed (3.1m)`
- QA writes: `NONE`

The QA session was authenticated manually. The harness default uses the
canonical metadata path `.auth/costa-clean-storage-state.json`. No credentials,
tokens, cookies or auth metadata were requested, printed, copied or committed.

## Exact viewport matrix

| Requested | innerWidth | innerHeight | clientWidth | clientHeight | scrollWidth | scrollHeight | Root overflow | Shell |
|---|---:|---:|---:|---:|---:|---:|---|---|
| 390x844 | 390 | 844 | 390 | 844 | 390 | 1464 | PASS | Bottom navigation |
| 768x1024 | 768 | 1024 | 768 | 1024 | 768 | 1208 | PASS | Bottom navigation |
| 1280x800 | 1280 | 800 | 1280 | 800 | 1280 | 1033 | PASS | Navigation rail |
| 1920x1080 | 1920 | 1080 | 1920 | 1080 | 1920 | 1270 | PASS | Navigation rail |

Requested dimensions equal measured `innerWidth`/`innerHeight` in every case;
`scrollWidth <= clientWidth` in every case. Shell ownership, duplicate-shell
absence and the geometry values are hard assertions in the release harness.

## Release matrix

| Area | Result | Evidence |
|---|---|---|
| QA authentication | PASS | Auth gate passed |
| Hard reload session | PASS | Available entity deep-links reload and restore workspace |
| QA backend | PASS | QA project guard clean |
| Production request guard | PASS | `productionRequests=0` in every viewport |
| Home | PASS | Heading assertion in every viewport |
| Clients | PASS | Heading and hydrated workspace assertions |
| Client media | PASS | Native media presentation asserted |
| Recurring section empty state | PASS | Section, `Sin planes recurrentes`, create entry and sheet opening asserted |
| Existing recurring plan runtime | N/A | `recurring_invoice_plans=0` in QA baseline |
| Leads | PASS | Heading and deep-link/back assertions |
| Properties | PASS | Heading and deep-link/back assertions |
| Quotes | PASS | Surface navigation; deep-link N/A because baseline has 0 records |
| Services | PASS | Surface navigation; workspace/deep-link N/A because baseline has 0 records |
| Invoices | PASS | “Todas” filter, workspace and deep-link/back assertions |
| Payments | PASS | Surface navigation; deep-link N/A because baseline has 0 records |
| Expenses | PASS | Heading and deep-link/back assertions |
| Alerts | PASS | Heading assertion in every viewport |
| Closings | PASS | Heading assertion in every viewport |
| Navigation / More | PASS | Module labels and dialog assertions |
| Back navigation | PASS | Available deep-links return to their list heading |
| Cross-module Client → Property | PASS | Relation opened native property workspace |
| Cross-module Client → Invoice | PASS | Relation opened native invoice workspace |
| Accessibility keyboard smoke | PASS | Keyboard dialog opening and focus containment asserted |
| Reduced motion | PASS | `prefers-reduced-motion` asserted at `390x844` |
| Manifest | PASS | Manifest link asserted |
| Service worker | PASS | `notification-sw.js` response asserted |
| Loading/recovery | PASS | Authenticated surfaces hydrate without runtime errors |

## Deep-link coverage

- Clients: `PASS` — hydrated row, workspace, reload and back.
- Leads: `PASS` — hydrated row, workspace, reload and back.
- Properties: `PASS` — hydrated row, workspace, reload and back.
- Invoices: `PASS` — “Todas” filter, hydrated row, workspace, reload and back.
- Expenses: `PASS` — hydrated row, workspace, reload and back.
- Quotes: `N/A — no existing QA record`.
- Jobs: `N/A — no existing QA record`.
- Payments: `N/A — no existing QA record`.

## Zero-legacy and runtime evidence

Hard assertions passed at every inspected surface and viewport:

- Legacy runtime markers: `0`
- Visible UUID: `0`
- Accessible UUID: `0`
- Unicode-as-icon: `0`
- `window.confirm`: `0`
- Duplicate shell: `0`
- Root overflow: `0`

Per-viewport runtime counters were all zero:

- Production requests: `0`
- Non-QA Supabase requests: `0`
- QA mutation requests: `0`
- Critical failed requests: `0`
- Page errors: `0`
- Console errors: `0`

## QA inventory and delta

The external project-scoped read-only comparison confirmed unchanged,
pre-existing QA inventory:

| Resource | Pre-run | Post-run |
|---|---:|---:|
| clients | 8 | 8 |
| leads | 2 | 2 |
| properties | 2 | 2 |
| quotes | 0 | 0 |
| jobs | 0 | 0 |
| invoices | 8 | 8 |
| payments | 0 | 0 |
| expenses | 1 | 1 |
| recurring_invoice_plans | 0 | 0 |

| Storage bucket | Pre-run | Post-run |
|---|---:|---:|
| client-profile-media | 0 | 0 |
| expense-receipts | 0 | 0 |
| invoice-documents | 2 | 2 |

- QA DB delta: `PASS — 0`
- QA Storage delta: `PASS — 0`
- QA release-suite residue: `0`
- QA cleanup: `NOT REQUIRED`

Existing QA rows and objects were preserved. No cleanup was authorized or
required, and no QA fixture was created.

## Quality gates

- Unit/integration tests: `702 passed | 4 skipped`
- Release E2E: `5 passed`
- Lint: `PASS`
- Build: `PASS`
- Diff: `PASS`

## V3-9 prerequisites — not authorized

V3-9 must not start without explicit authorization for:

1. Production activation.
2. Review and application of the V3-7A production media migration.
3. Production environment verification.
4. Controlled deployment.
5. Production smoke.
6. Rollback plan.
7. Feature-flag activation decision.

No production deployment, SQL, migration, storage, auth mutation, DNS change,
feature-flag activation or production data change was performed.

## Verdict

`V3-8 CLOSED / CERTIFIED`

`NEXT: V3-9 — CONTROLLED PRODUCTION ACTIVATION — DO NOT START WITHOUT EXPLICIT AUTHORIZATION`
