# PR #28 / PR #34 local consolidation

Status: local candidate only. No source branch, PR, remote database, or deployment
was changed.

## Source identities

- Base: `main` / `origin/main` at `4de0a81feecc6256e860ec982e6a9e77f80e536b`.
- V3: `origin/release/costa-clean-v3-integrated-20261009` at
  `6c2d5f265744fa9c4f9f0d81b0d6e8d8fbb1fe61`; 257 paths and 18 migrations
  against its reported base, and 267 touched paths relative to current main.
- Frontend recovery: `origin/codex/recovery-ui-functionality-2026-11-04` at
  `e911a79222339ef16ae1abe700e45a39ff61d1d8`; 20 commits and 54 paths.
- Financial compatibility source: `codex/p0-v3-n56-compatibility` at
  `e9c0ec4131cc03d5a4104874f1669b547df2d746`.
- Current remote `main` was read with `git ls-remote` and still matched the base
  SHA above.

## Conflict decisions

The branches share 41 touched path names against current main. All 23 content
conflicts between V3 and frontend recovery are resolved; the other 18 shared
paths merged automatically. These choices retain behavior from both sides
rather than selecting a whole branch.

| Conflict path | Resolution |
|---|---|
| `src/features/closing/closingSummaryEngine.test.ts` | Kept the combined coverage for live financial cohorts and snapshot behavior. |
| `src/features/closing/closingSummaryEngine.ts` | Live, refetched values remain authoritative; snapshots remain historical context; payment cohort semantics stay invoice-issue-date based. |
| `src/features/closing/fiscalPeriodNotes.test.ts` | Retained period-scoped note and draft-isolation cases from both sides. |
| `src/features/closing/invoicePaymentCohort.ts` | Combined invoice IDs, linked payments, and per-invoice paid totals needed by V3 and the recovery consumers. |
| `src/features/invoices/InvoiceDetailCard.tsx` | Kept V3 service-reference resolution and recovery edit hydration/can-save behavior. |
| `src/features/quarterlyClosing/quarterlyClosingSummary.test.ts` | Retained both quarterly summary and cohort regression cases. |
| `src/pages/InvoicesPage.tsx` | Wired the shared issue action and refresh callback; retained current cancellation/update behavior. |
| `src/pages/QuarterlyClosingPage.tsx` | Reused the shared payment-cohort helper for the quarterly screen. |
| `src/v3/closing/V3ClosingPage.tsx` | Kept period-key scoped recovery state and the V3 calculated summary/snapshot separation. |
| `src/v3/components/V3Primitives.tsx` | Kept recovery semantics and styling while restoring V3 tabs/list workspace and KPI `className` support. |
| `src/v3/design/v3.css` | Kept recovery narrow-phone rules and restored V3 governed shell, list, brand, and document-preview rules. |
| `src/v3/home/V3HomePage.tsx` | Kept the recovery dashboard/period queues and V3 financial model; overview now precedes priority queues. |
| `src/v3/home/V3HomePriorityQueue.tsx` | Retained both current-state and selected-period actions. |
| `src/v3/home/V3RevenueTrend.tsx` | Kept the recovery trend behavior within V3's shared presentation. |
| `src/v3/home/executiveDashboardModel.test.ts` | Combined period/cohort tests and the billed-job regression case. |
| `src/v3/home/executiveDashboardModel.ts` | Retained invoice-cohort totals and excluded already-invoiced jobs from unbilled totals. |
| `src/v3/invoices/V3InvoiceEditFlow.tsx` | Kept the V3 three-step flow plus issued-invoice correction attestation and fiscal-number guards. |
| `src/v3/invoices/V3InvoicesPage.tsx` | Kept V3 list/navigation and pagination with the shared guarded issue action and refresh callback. |
| `src/v3/jobs/V3JobWorkspace.tsx` | Kept the V3 StepFlow and recovery validation/error handling. |
| `src/v3/leads/V3LeadsPage.test.ts` | Retained assertions for both KPI contracts. |
| `src/v3/leads/V3LeadsPage.tsx` | Kept V3 KPI summary, accessible tabs, and pagination. |
| `src/v3/leads/leadKpiModel.test.ts` | Combined KPI model regression cases. |
| `src/v3/leads/leadKpiModel.ts` | Kept the combined lead KPI derivation. |

## Historical 36-requirement coverage

The inventory comes from `docs/SCREENSHOT_CORRECTIONS_CLOSEOUT_2026-09-24.md`
and its production closeout at screenshot-branch commit `c113da87`. Those
historical documents report a 20-screenshot/36-requirement PASS for the older
product RC `2d81aff8893fbc89ab041c38e9e657e632aec38a`; neither commit is an
ancestor of this candidate. Historical browser results are therefore not
reused as current-candidate visual proof.

`Code` means the relevant implementation exists in this candidate. `Tests`
means local automated coverage exists and the complete suite passed; it does
not imply live persistence. `Visual` records evidence for this exact candidate.

| ID | Requirement area | Code | Relevant automated coverage | Visual on this candidate |
|---:|---|---|---|---|
| 1 | Shared compact status pills | Present: `V3Status` / `V3EntityStatus` | Primitive and visual-governance tests | Not retested |
| 2 | Cierres period-outflow layout | Present in V3 closing composition | `V3ClosingPage.test.ts` structure/state cases | Not retested |
| 3 | Assisted-summary readability | Present as a separate closing section | `V3ClosingPage.test.ts` | Not retested |
| 4 | Cierres hierarchy | Present: calculated values, assistive output, snapshot separated | `V3ClosingPage.test.ts` | Not retested |
| 5 | Facturado cohort by issue date | Present in shared closing model | `closingSummaryEngine.test.ts`, `quarterlyClosingSummary.test.ts` | Not applicable to model; browser not retested |
| 6 | Cobrado linked to same invoice cohort | Present in shared cohort helper | Same cohort tests | Not applicable to model; browser not retested |
| 7 | Exclude cross-period payment inflation | Present | Closing and executive model cohort tests | Not applicable to model; browser not retested |
| 8 | Separate base, VAT, and gross total | Present | V3 closing page tests | Not retested |
| 9 | Reconcile true invoice totals | Present in deterministic model | Closing summary/cohort tests | Not applicable to model |
| 10 | Label estimates vs tax filing | Present in closing copy | Closing page render tests | Not retested |
| 11 | Actionable closing warnings | Present in current V3 action/deep-link contracts | General alert/home tests; exact warning-by-warning interaction not isolated | Not retested |
| 12 | Compact mobile order/filter controls | Present in shared control CSS | `v3CoreCorrections.test.ts` | Not retested |
| 13 | Reduce nested surfaces | Present in flat invoice/list compositions | `V3InvoicesPage.test.ts` | Not retested |
| 14 | Primary/secondary action hierarchy | Present in shared primitives and finance workspaces | Primitive and finance hierarchy tests | Not retested |
| 15 | Invoice detail hierarchy | Present in V3 invoice workspace | `V3InvoicesPage.test.ts` | Not retested |
| 16 | Fiscal numbering tools gated to debug context | Present via `shouldShowInvoiceFiscalDebug()` | `invoiceFiscalSnapshot.test.ts` | Not retested |
| 17 | Compact mobile KPIs | Present in V3 KPI/layout rules | Home and visual CSS tests | Not retested |
| 18 | Suppress non-informative zero KPIs | Present in dashboard model/render conditions | `V3HomePage.test.tsx`, model tests | Not retested |
| 19 | Suppress zero/no-action alerts | Present in home-priority model | `homePriorities.test.ts` | Not retested |
| 20 | Alert deep-link to useful target | Present in action registry and app navigation | Related navigation tests exist; full alert-by-alert browser path not run | Not retested |
| 21 | Persist duplicate review state | Present through `useDuplicateResolution` / alert decision API | No isolated database round-trip in this work | Not retested; persistence unverified |
| 22 | Keep reviewed duplicates resolved after reload | Present through persisted decision hydration | No isolated database round-trip in this work | Not retested; persistence unverified |
| 23 | Keep agenda from displacing Home summary | Present: V3 Home renders summary and priority queues, no agenda block | Home composition/render tests | Not retested |
| 24 | Prioritize useful financial/operational Home data | Present in executive model and queues | `executiveDashboardModel.test.ts`, `V3HomePage.test.tsx` | Not retested |
| 25 | Compact expense fiscal review | Present in V3 expense workspace | `V3ExpenseWorkspace.test.ts`, finance hierarchy test | Not retested |
| 26 | Reduce repetitive technical copy | Present in relevant V3 copy; subjective full-screen review remains | No complete copy-specific regression suite | Not retested |
| 27 | Compact controls with usable touch targets | Present using governed touch tokens | `v3CoreCorrections.test.ts`, global visual tests | Not retested |
| 28 | Use viewport width effectively | Present in V3 shell/content rules | Full-width CSS contract test | No geometry capture |
| 29 | Prevent wrapping/min-width defects | Present in invoice/payment rows and responsive rules | `v3CoreCorrections.test.ts` | No geometry capture |
| 30 | Reduce avoidable vertical length | Present in grouped/ordered closing and finance sections | Closing and finance hierarchy tests | Not retested |
| 31 | Put result before configuration | Present; snapshot separated from calculated results | `V3ClosingPage.test.ts` | Not retested |
| 32 | Avoid multiple equal-weight primary CTAs | Present in finance action grouping | Finance hierarchy and invoice tests | Not retested |
| 33 | 390x844, 768x1024, 1440x900 matrix | Viewport contract exists | Governance tests check matrix declaration | Actual visual matrix not run |
| 34 | Zero horizontal overflow | Responsive safeguards exist in CSS | Static wrapping tests only | Runtime geometry not measured |
| 35 | Real visual verification | Not an implementation property | No current-candidate browser evidence | Pending |
| 36 | Screen-by-screen review | Not completed for this candidate | No current-candidate screen matrix | Pending |

The code and automated suite are substantially covered; screenshot dimensions,
overflow geometry, and duplicate-review persistence are not certified on this
combined candidate. The old screenshot RC's PASS is historical evidence only.

## Migration and security boundary

- The 18 V3 migration files remain source code; no migration was executed.
- The existing 5-equivalent/13-pending reconciliation remains a precondition
  for a future database release; this merge does not resolve or rewrite the
  remote ledger.
- The two compatibility migrations are unchanged from `e9c0ec4`:
  `20261002165959_p0_expense_financial_guard_before_n56.sql` runs directly
  before N56; original N56 and grant hardening remain unchanged; then
  `20261002173001_p0_expense_financial_guard_reconcile.sql` runs before P0.
- Static compatibility tests pass. There was no representative PostgreSQL
  execution, transaction/role matrix run, Storage verification, or remote SQL.
- P0 PR #30 remains separate and its migration is not included implicitly.
- Main's exact base is an ancestor, so its already-integrated code changes are
  retained. V6/vNext paths have no changes in this candidate.

## Local verification

- Focused merge regressions: 30/30 tests passed.
- Full suite: 229 files; 1,185 passed, 4 skipped.
- N56 compatibility static suite: 4/4 passed.
- `npm run lint`: passed.
- `npm run build` (includes `tsc -b`): passed.
- `git diff --check`: passed.
- No browser QA, synthetic persistence, SQL execution, push, merge to `main`,
  or deployment was performed for the consolidated candidate.
