# Costa Clean — V3 global final certification (clean release candidate)

## Candidate and scope

- Reviewed HEAD: `94c1ddee7f2c145306420651de1abae213c781c2`
- Branch: `codex/v3-clean-release-candidate`
- Clean lineage: PASS from `a42bad7c650d98d5366472c59bea0bf6e71c2123`
- Source certified product reference: `29ae7a22d15fca5fdc7ceb06b3f7a525d089aadc`
- Scope: Costa Clean internal V3 app only.
- Excluded lineage: Client Portal, CP5.1, Management API, JIT/PAT, public funnel, backup/restore and unrelated infrastructure.
- Production deploy: NO. Production mutations: 0. Supabase production mutations: 0.

The reconstruction proof is recorded in `docs/V3_CLEAN_RELEASE_CANDIDATE_RECONSTRUCTION.md`. The candidate contains no excluded-flow paths and the approved internal product tree is parity-checked against the source candidate, with the intentional internal-only `App`/`main` decontamination split documented there.

## Internal V3 test-domain audit

The reduced suite is intentional: excluded Portal/public-funnel/sandbox/infrastructure tests are absent. The clean branch has 129 test files, 479 passing tests and 0 skipped tests. All required internal domains are present and green in the full `npm test -- --run` run.

| Domain | Evidence | Result |
| --- | --- | --- |
| V3 shell/design and branding | `src/v3/design/*`, `src/v3/shell/*`, `src/v3/brand/*`, quality guardian | PASS |
| Home/dashboard, financial model, inter-period collections, VAT | `src/v3/home/*`, `src/v3/finance*`, financial/invoice settlement/payment tests | PASS |
| Clients | `src/v3/clients/*`, `src/features/clients/*` | PASS |
| Properties | `src/v3/properties/*`, `src/features/properties/*` | PASS |
| Leads | `src/v3/leads/*` | PASS |
| Invoices | `src/v3/invoices/*`, `src/features/invoices/*`, `src/pages/InvoicesPage.test.ts` | PASS |
| Quotes | `src/v3/quotes/*`, `src/features/quotes/*` | PASS |
| Payments | `src/v3/payments/*`, `src/features/payments/*` | PASS |
| Expenses | `src/v3/expenses/*`, `src/features/expenses/*` | PASS |
| Services / Jobs | `src/v3/jobs/*`, `src/features/jobs/*` | PASS |
| Alerts and notifications | `src/v3/alerts/*`, automation/notification tests | PASS |
| Closings / fiscal | `src/v3/closing/*`, `src/features/closing*` | PASS |
| Recurring Plans | `src/v3/recurring/*`, `src/features/recurringInvoices/*` | PASS |
| Document preview parity | `InvoiceDocumentA4`, `QuoteDocumentA4`, `V3DocumentPreview`, pagination/output tests | PASS |
| Scalable lists | `useV3ListWindow`, V3 list/page governance | PASS |
| Monostep StepFlows | `V3StepFlow`, `V3ExpenseFormFlow`, shell/flow governance | PASS |
| Responsive/mobile, viewport and safe-area governance | V3 shell/design governance plus authenticated matrix | PASS |
| Accessibility-related governance | shared V3 shell/design/StepFlow assertions and authenticated checks | PASS |

## Product certification

- Home: PASS. Invoiced, collected, outstanding, expenses, estimated result, VAT outputs/input, growth, operational KPIs, attention queue, direct actions and governed trend chart are present and real-data driven.
- Financial model: PASS. Invoice issue-date invoiced basis, actual payment-date collected basis, canonical outstanding/expense semantics and honest estimated VAT model remain covered.
- Inter-period collections: PASS, including cross-period settlement semantics in the deterministic financial tests.
- Document previews: PASS. Invoice and quote thumbnails use the canonical A4 source; full preview, multipage output and download/share parity tests pass.
- Scalable lists: PASS. Default bounded pagination is 25; full-page infinite scroll is absent; search/filter/result-count/pagination and contained scrolling are governed.
- Monostep flows: PASS. One logical step at a time, visible progress, state-preserving Back/Next, validation, prefill and reachable final actions are covered; StepFlow body/page scroll remains zero by contract.
- Global visual contract: PASS. One visible Costa Clean logo, `V3BrandLockup`, differentiated navigation/header/canvas, semantic palette, branded preloader, functional invisible-scrollbar governance and safe-area/full-viewport contracts remain green.

## Authenticated responsive evidence

Fresh isolated Edge QA was run against `http://127.0.0.1:4173/?v3=1` with no auth bypass and no unsafe final submit.

| Viewport | Result |
| --- | --- |
| 320x568 | PASS |
| 390x844 | PASS |
| 430x932 | PASS |
| 768x1024 | PASS |
| 820x1180 | PASS |
| 834x1194 | PASS |
| 1024x1366 | PASS |
| 1280x800 | PASS |
| 1440x900 | PASS |
| 1920x1080 | PASS |

Authenticated interaction matrix: **1320/1320 PASS**. The run covered Home, Clients, Properties, Quotes, Jobs/Services, Invoices, Expenses, Payments, fiscal closing, representative create-flow openings, navigation, shell geometry and responsive reachability. QA profile and reports are private/ignored and were not committed.

## Runtime safety and network evidence

- `AUTH_SESSION_PRESENT`: YES.
- `QA_IDENTITY_PRESENT`: YES; isolated authenticated Edge profile used.
- `AUTH_BYPASS_USED`: NO.
- `AUTH_REDIRECT`: NO.
- `QA_BUSINESS_WRITES`: 0; no final business submit was performed.
- `PRODUCTION_BUSINESS_WRITES`: 0.
- `PRODUCTION_SUPABASE_REQUESTS`: 0; QA target was local preview, not Production.
- `UNKNOWN_SUPABASE_REQUESTS`: 0 by environment/scope guard; no unknown Supabase target was used.
- `FAILED_REQUESTS`, `CONSOLE_ERRORS`, `PAGE_ERRORS`: 0 in the authenticated QA report.
- `QA_SUPABASE_REQUESTS`: the existing authenticated visual runner does not expose a request-count ledger; no fabricated count is asserted. Its environment is local preview with the isolated QA identity and no business writes.

This is a limitation of the available runner telemetry, not a failed product gate: the local-only target and zero-write QA contract are independently enforced by the runner and repository guardrails.

## Quality gates and build

- Focused certification suite: **17 files, 71 tests PASS**.
- Full internal suite: **129 files, 479 passed, 0 skipped**.
- Agents: **294/294 PASS**.
- Lint: PASS.
- TypeScript/build: PASS; 657 modules transformed.
- `git diff --check`: PASS.
- Secret scan: PASS for literal credential/token patterns; no exposed secret values.

Final build evidence:

- Main bootstrap bundle: `bootstrapCrm-BBIDLIQr.js`, 375.07 kB / 105.77 kB gzip.
- Largest lazy chunk: `jspdf.es.min-CB0eO1Rl.js`, 399.83 kB / 129.85 kB gzip.
- Chart: governed chart code remains in the internal bootstrap chunk; no duplicate chart dependency introduced.
- Document preview: `V3DocumentPreview-iv8JR13M.js`, 9.37 kB / 3.65 kB gzip; canonical A4 chunks remain lazy (`InvoiceDocumentA4`, `QuoteDocumentA4`).

## Fresh independent global review

The independent review covered clean lineage, excluded-flow absence, approved internal tree parity, branding, responsive shell, dashboard/financial semantics, document parity, bounded lists, monostep flows, accessibility governance and authenticated runtime evidence. No reproducible product defect was found.

Severity matrix:

- P0 = 0
- P1 = 0
- P2 = 0
- P3 = 0

The repository's `AGENTS.md` references eight Stitch/design documents that are not present in this reconstructed clean branch. This is an evidence-availability discrepancy in the checkout, not a product defect; the available V3 design-system, visual governance, roadmap and R1–R6 certification artifacts were used and all gates above passed.

## Verdict

**GLOBAL_V3_CERTIFICATION = PASS**

**RELEASE_CANDIDATE = READY**

Production remains explicitly gated. The next exact gate is **EXPLICIT_PRODUCTION_DEPLOY_AUTHORIZATION**.
