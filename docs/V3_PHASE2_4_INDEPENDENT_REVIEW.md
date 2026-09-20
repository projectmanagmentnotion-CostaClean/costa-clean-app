# Costa Clean V3 — Phase 2.4 independent review

Status: `REMEDIATED_BLOCKED_BY_REVIEW_CAPABILITY`.

## Review boundary

- Reviewed commit: `48044d2c551929e06f753c5d1d20f5273c0bc764`.
- Reviewed tree: `6b8fcd517d872159762da09c27722b1238925a82`.
- Review mode: detached, exact-SHA checkout; read-only product review.
- The recovery branch and original checkout were not rewritten. No production or
  Supabase mutation was performed.
- The previous orchestration timeout was `--review-timeout-ms 120000`. A retry
  with `--review-timeout-ms 600000` completed. The detached checkout initially
  lacked dependencies; review capability was restored with a local junction to
  the already-installed `node_modules`, without installation or product changes.

## Independent result

The reviewer returned `stop`: P0 `0`, P1 `3`, P2 `2`, P3 `0`.

### Blocking P1 findings

1. Invoice creation no longer propagates job/quote-origin client, property,
   notes and billing-line data after the React effect removal.
2. Client and property workspace `Editar` actions still increment and pass an
   edit token, but the detail cards no longer consume that token to open edit
   mode.
3. Fiscal, annual and quarterly closing selection/notes are not synchronized
   with the selected persisted closing; notes can remain stale and be saved
   against another period.

### Non-blocking but required follow-up

- Payment prefill/outstanding-balance synchronization is also missing (P2).
- Focused regression tests are absent for the affected invoice, edit-token,
  payment-prefill and closing-period contracts (P2).

## Evidence that remains valid

- Deterministic authenticated runner: `11 passed` across the exact 10
  viewports; requested and actual dimensions matched and overflow was false.
- Sanitized ledger: 26,050 requests; 3,160 QA Supabase; 0 production Supabase;
  0 unknown Supabase; 0 unknown mutations; 0 failed requests; 0 page errors;
  0 console errors.
- The review found no committed credentials, cookies, JWTs, tokens, QA
  profiles, private reports or screenshots. The QA evidence remains ignored
  and private.

The deterministic visual/network evidence cannot override protected-contract
P1 findings that require functional interaction and write-path review.

## Remaining gates

Settlement and expense QA writes, expense signed-document behavior, AI/provider
behavior, duplicate prevention, recurring/long-list stress and any production
behavior remain uncertified. New Expenses/Vendors visual work remains
`STITCH UI DESIGN PENDING`; no generic replacement UI is authorized.

No product fix is included in this review-close documentation. The next safe
implementation block must correct the three P1 findings, add focused tests,
rerun the required quality gates, and obtain a fresh independent review.

## Phase 2.5 remediation status

The three P1 contracts have now been remediated locally and are not yet
certified until a fresh detached reviewer completes:

- Job and quote source selection now applies client, property, notes and
  editable billing lines through explicit selection handlers. The canonical
  `acceptQuoteWorkflow` / `accept_quote_workflow` path remains unchanged.
- Client and property workspace edit requests now remount the canonical detail
  card with the request token and open the persisted entity in edit mode; no
  duplicate-create or V2 route was introduced.
- Fiscal notes now resolve from a period-keyed draft over the selected
  persisted closing, so switching periods cannot display or save another
  period's note.
- Focused contract tests pass: invoice source prefill and fiscal-period note
  isolation. Remote QA writes were not performed.
- The deterministic authenticated rerun passed `11/11` again across the exact
  10 viewports: 26,380 requests, 3,160 QA Supabase requests, 0 production or
  unknown Supabase requests, 0 QA business writes, 0 unknown mutations, 0
  failed requests, 0 page errors and 0 console errors.

P2 findings remain open for a separate bounded follow-up: payment
prefill/outstanding-balance synchronization and additional focused coverage
for payment/workspace/closing interactions.

The fresh review of remediation commit `f8c1fa4bd8b126def359d6e54cae60630154b043`
found one residual P1 in V3 closing: prop/default selection synchronization and
period-scoped feedback could remain stale. This follow-up restores the
period-keyed note/message isolation and keys the V3 closing shell to the
authoritative selection, without reintroducing state-setting effects.

## Final exact-HEAD review boundary

The final remediation commit is `b8ea82b83d97dc3eb8f0a7f0d552fe6408307c29`.
The detached independent reviewer reconstructed this exact tree and found no
source-level P0 or P1 defect: P0 `0`, P1 `0`, P2 `2`, P3 `0`. Its verdict was
`BLOCKED`, not `PASS`, because its read-only child capability denied the
temporary writes required to run tests and build, and it could not replay the
authenticated runtime matrix against the exact HEAD from that detached
environment. The main worktree independently verified the full test suite,
lint, build, diff check and authenticated 11/11 matrix at this HEAD, but that
does not waive the independent-review capability boundary.

The remaining P2 items are payment prefill/outstanding-balance synchronization
and focused payment/workspace/closing interaction coverage. No certification
claim is made for Phase 2 until independent exact-HEAD validation is runnable.

## Phase 2.4 final remediation attempt

The independent review of exact HEAD `9e92f89f69606def13d9ad4819c46fa5b2c8cf70`
found a real P2 bypass in the legacy duplicate-review `continue anyway` path:
it saved directly without re-running the payment amount invariant. The executor
closed that bypass in `7b80795fa2cdad6dde4fb50cd86e523457dca3d0` and pushed it to
the recovery branch. The shared payment amount guard now covers legacy create,
V3 create, legacy form, V3 manual edit, legacy detail edit, and the duplicate
override path; legacy sync also uses the invoice outstanding amount.

Exact-HEAD evidence for `7b80795`:

- Full local Vitest: `168` files, `888` passed, `4` skipped.
- Agents: `294/294 PASS`; lint, build, typecheck and `git diff --check` pass.
- Authenticated read-only matrix: `11/11 PASS` across 10 viewports; 26,400
  requests, 3,160 QA Supabase requests, zero production/unknown Supabase
  requests, zero QA business writes, zero unknown mutations, zero failed
  requests, zero page errors and zero console errors.
- Independent detached review: source-level P0 `0`, P1 `0`; the final exact-
  HEAD replay is still blocked because the reviewer sandbox cannot open the
  persistent authenticated Chrome profile without mutating it. Its full suite
  also retains three unrelated child-process/Git-ownership infrastructure
  failures; no product payment assertion failed.

The payment P2 is therefore fixed in source and independently reviewed through
the remediation path, but Phase 2.4 remains uncertified. Interaction coverage
and exact-HEAD independent authenticated replay remain the certification gate.

## Detached authenticated final review

The final detached review was rerun from exact HEAD
`782d7c532413bb00eebfd76156b26efec821cf26` using a disposable copy of the
authenticated QA Chrome profile. The persistent operator profile was not
opened or modified, no auth bypass was used, and no product, Supabase or
production mutation was performed.

The authenticated replay passed `11/11` across the exact 10 viewport matrix.
The sanitized evidence recorded 26,398 requests, 3,158 QA Supabase requests,
zero production or unknown Supabase requests, zero QA business writes, zero
production writes, zero unknown mutations, zero failed requests, zero page
errors and zero console errors. The detached reviewer also passed 32/32
focused tests, `qa:agents` 294/294, lint and `git diff --check`.

The previous auth-profile capability blocker is cleared. The detached review
still returns `BLOCKED` because its isolated dependency bootstrap produces an
incomplete `core-js@3.50.0` tree and Vite cannot complete the production build
(84 unresolved dependency imports). This is an environment/toolchain failure,
not an application assertion. Two non-blocking P2 coverage gaps remain for a
separate interaction/write-path certification block; no P0 or P1 was found.

Phase 2.4 therefore remains `BLOCKED` pending a clean detached dependency
environment and closure of the remaining P2 interaction coverage gate.
