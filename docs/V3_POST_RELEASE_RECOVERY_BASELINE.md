# Costa Clean V3 — Post-release recovery baseline

Status: versioned comparison baseline for Phase 2.1.

## Identities and environment

- Authoritative main SHA: `368ed1f75ecda0c0f383c6df4ccffee216db76ce`
- Recovery candidate starting SHA: `4842f3da825a7bd542fa02abb8f8c0cba5d50558`
- Candidate branch: `codex/v3-post-release-mobile-functional-recovery`
- OS: Windows `10.0.26200.0`
- Node: `v24.19.0`
- npm: unavailable on this Home-PC runtime (`npm --version` could not be executed).
- Available package manager: pnpm `v11.19.0`.
- Install strategy used in both worktrees: `pnpm install --lockfile=false --ignore-scripts`.
- Lockfile: `package-lock.json`, SHA-256 `0d6704dcc499bb888b43debfbf74f71ed2866247cca38e10fb09f40335b74738`.
- Git: `2.52.0.windows.1`.
- Git line endings: `core.autocrlf=input`; `core.eol` unset.
- Relevant environment difference: candidate has ignored local QA configuration and authenticated QA profile; the clean main baseline has neither. No secrets are recorded here.

The npm absence is an environment limitation, not a gate waiver. Both trees were installed with the same available pnpm/runtime pair and the same committed lockfile identity.

## Commands

The following were run against the clean detached main worktree and the recovery candidate using the same Node runtime and dependency strategy:

```text
npm test                 [represented by direct Vitest invocation; npm unavailable]
npm run qa:agents        [represented by direct Node invocation]
npm run lint             [represented by direct ESLint invocation]
npm run build            [represented by direct Vite build invocation]
git diff --check
```

## Main baseline result

| Gate | Result |
|---|---:|
| Tests (clean first run) | 859 passed, 4 skipped, 8 failed |
| Agents | 294/294 passed |
| Lint | 44 errors, 0 warnings |
| Build | PASS |
| Diff check | PASS (clean baseline) |

### Exact baseline test failures

The clean first run exposed eight failures. The two `ENOENT` failures below depend on the ignored `.project-agent/private` directory not existing. After creating that ignored directory in both worktrees, the normalized comparison run produced 861 passed, 4 skipped, 6 failed on main and 865 passed, 4 skipped, 6 failed on the candidate. The six stable failures are classified as baseline debt; the two `ENOENT` cases are environment-preparation failures (classification B), not recovery regressions:

1. `scripts/ops/run-project-continuation-agent.test.mjs` — continuation public publication pipeline — checks every reviewed candidate in a temporary index before actual staging — `ENOENT` temporary private directory (first clean run only; B).
2. `scripts/ops/projectContinuationAgentCore.test.mjs` — scans dynamically created tracked and untracked candidate content without staging private fixtures — `ENOENT` temporary private directory (first clean run only; B).
3. `scripts/client-portal/cp2bWindowsLauncherV3.test.mjs` — executes a real cmd shim with paths and arguments containing spaces — `command_failed:fixture command.cmd` (stable; A/B environment debt).
4. `scripts/client-portal/cp2bWindowsLauncherV3.test.mjs` — patches the V2 child-process path before it imports spawnSync — `command_failed:node.exe` (stable; A/B environment debt).
5. `scripts/client-portal/cp2bSandboxCompatibilityV6.test.mjs` — proves the frozen V4 child fails closed after Git can inspect this exact repository — `command_failed:node.exe` (stable; A/B environment debt).
6. `scripts/client-portal/cp3b2aV6RealAdapter.test.mjs` — exposes the V6R1E package contract — test timeout (5 seconds; stable).
7. `scripts/client-portal/cp3b2aQaApplicationV6.test.mjs` — validates the V6R1E manifest and package contract — test timeout (5 seconds; stable).
8. `scripts/client-portal/cp3b2aQaApplicationV6.test.mjs` — preflights read-only and creates a fresh private backup model — test timeout (5 seconds; stable).

## Exact baseline lint groups

All 44 errors are `react-hooks/set-state-in-effect`. Relative file and line identities:

```text
src/features/clients/ClientBillingDetailsInlineForm.tsx:31
src/features/clients/ClientDetailCard.tsx:130,157,163
src/features/expenses/ExpenseCreateFlow.tsx:150
src/features/expenses/ExpenseEditFlow.tsx:121
src/features/expenses/ExpenseSupportFieldset.tsx:109
src/features/invoices/InvoiceCreateFlow.tsx:255,341,357,372,386
src/features/invoices/InvoiceCreateForm.tsx:271,287,303
src/features/invoices/InvoiceDetailCard.tsx:380,420
src/features/invoices/useInvoiceDocumentLines.ts:27
src/features/jobs/JobCreateFlow.tsx:233,244
src/features/jobs/JobCreateForm.tsx:199,211
src/features/leadDrafts/LeadDraftCards.tsx:95
src/features/leads/LeadDetailCard.tsx:52
src/features/payments/PaymentCreateFlow.tsx:160,196
src/features/payments/PaymentCreateForm.tsx:139,156
src/features/payments/PaymentDetailCard.tsx:84
src/features/properties/PropertyDetailCard.tsx:115,132
src/features/quotes/QuoteCreateFlow.tsx:150
src/features/quotes/QuoteDetailCard.tsx:201
src/features/quotes/useQuoteDocumentLines.ts:28
src/pages/AnnualClosingPage.tsx:152,174
src/pages/FiscalClosingPage.tsx:162,195
src/pages/QuarterlyClosingPage.tsx:174,203
src/portal/PortalServiceArea.tsx:605
src/v3/closing/V3ClosingPage.tsx:31
src/v3/jobs/V3JobCreateFlow.tsx:52
src/v3/leads/V3LeadWorkspace.tsx:50
```

## Candidate delta methodology

The candidate was run with the same toolchain and compared by exact test failure identity and exact lint file/line/rule identity. In the normalized comparison state, main produced 861 passed, 4 skipped, 6 failed and the candidate produced 865 passed, 4 skipped, 6 failed because the recovery branch contains four additional passing focused checks. The six stable failure identities match; the two first-run `ENOENT` failures disappear when the same ignored private directory is prepared in both trees. The candidate lint result is the same 44 file/line/rule identities above.

- New candidate test regressions: `0`.
- Resolved baseline test failures: `0` (two environment-preparation failures are classified B and are not candidate changes).
- New candidate lint errors: `0`.
- Resolved baseline lint errors: `0`.

The baseline debt remains visible and is not waived as green.
