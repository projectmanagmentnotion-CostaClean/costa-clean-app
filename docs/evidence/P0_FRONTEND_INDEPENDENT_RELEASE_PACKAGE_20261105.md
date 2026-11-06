# Costa Clean independent release packages — 2026-11-05

This file records preparation only. No merge, production migration, deployment,
backup restore, persistent QA change, or remote Git write was performed in this
work block. The P0 SQL was executed once in a QA transaction and explicitly
rolled back; that transaction is recorded below.

## FRONTEND RECUPERADO — PR #34

- PR: `https://github.com/projectmanagmentnotion-CostaClean/costa-clean-app/pull/34`
- State: open, Draft, mergeable; base `main` at
  `4de0a81feecc6256e860ec982e6a9e77f80e536b`.
- Candidate: branch `codex/recovery-ui-functionality-2026-11-04`, head
  `246ed381b8abbc4a362782778850215f96a20f76` (17 commits, 54 files).
- GitHub's changed-file listing contains no `supabase/migrations` path. The PR
  changes application and test files, including invoice flows and V3 UI; it does
  not depend on applying database migrations or granting broader database
  privileges.
- PR description reports 943 passing checks, 4 skips, lint/build pass and
  synthetic QA evidence. Those are PR-reported results, not rerun in this work
  block. Its description also reports that its Preview is isolated from
  Production. A fresh Vercel deployment query timed out, so current Preview
  readiness is not re-certified here.
- Technical rollback: revert the frontend merge commit or redeploy the exact
  current Production deployment. This does not change Supabase state. The exact
  current Production deployment ID must be rechecked at release time.
- Minimum checks before release: current PR CI green; current Preview READY for
  the exact head; final review of invoice/closing behavior; no migration files
  added; preserve PR Draft until owner-authorized merge/deploy.
- Security limitation: releasing this frontend alone leaves the existing
  Production expense/RPC exposure unchanged. It is independent of P0, not a
  substitute for P0.

## SEGURIDAD P0 — PR #30 plus local P0 candidate

- Remote PR: `https://github.com/projectmanagmentnotion-CostaClean/costa-clean-app/pull/30`
- Remote state: open, Draft; remote head remains
  `8b1984bb22107b4e4c127a505ca6e4c966abca78`.
- Local worktree branch: `codex/p0-expenses-rls`, base/head before local edits
  `8b1984bb22107b4e4c127a505ca6e4c966abca78`. The local closeout commit
  contains the P0 SQL/matrix adjustment, its static contract test, the rollback
  candidate, and this evidence package; it does not change the remote PR.
- Fresh read-only Production evidence for `wfxnwfcdjainpojhbdri`: migration
  ledger count 28, maximum version `20260924100831`; expenses has RLS and only
  the three broad authenticated INSERT/SELECT/UPDATE policies. The effective
  ACL shows anon INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN,
  authenticated all eight table privileges, and service_role all eight.
  Four existing SECURITY DEFINER RPCs have EXECUTE available to anon; two also
  inherit EXECUTE through PUBLIC.
- Fresh dependency check: `public.expenses`, its RLS, `public.internal_staff_memberships`,
  and `app_private.internal_staff_role_can_write_financially(text)` exist.
  `public.expense_staff_access(boolean)`, `public.confirm_expense_capture(...)`,
  and `public.expense_capture_confirmations` do not exist. This establishes that
  P0's required live objects are present and N55's V3 objects are not required
  for P0. The eleven older V3 migrations are not a P0 schema prerequisite.
- Local P0 migration SHA-256:
  `6D55299FE69912A94B32A7AD58B65C21EE23B8E128C27766F5D10594D1A38C50`.
- Local P0 matrix SHA-256:
  `CC0DCA4F4035C0532F93B59030EFD380350BFC932A9D3D3C03736A62BB5BD522`.
- Exact-hash QA transaction: `P0-3016A8C5`, executed against QA project
  `kpvvydthlxupjjqqdpxy` on PostgreSQL 17.6.1.147. Both SQL files above matched
  their SHA-256 values immediately before execution. The migration and full
  role/operation matrix completed with `P0_QA_SQL_PASS`; the matrix ended in
  `ROLLBACK`. This is runtime evidence for QA only, not Production readiness.
- Independent QA postcheck matched the pre-transaction fingerprint
  `6d917e4e4c7e4827d68ed6c5a2be195d`, found no helper function or synthetic
  expense/Auth/membership residue, and confirmed the expense sequence remained
  `last_value=17,is_called=true`. No persistent QA change was observed.
- The run checked transactional SQL/ACL/RLS behavior for the authorized matrix.
  It does not certify Production identity/prestate, a restorable backup,
  deployment mechanics, or the compensating rollback SQL below.
- Local static contract tests cover PostgreSQL 17 `MAINTAIN` revocation,
  preservation of `service_role` privileges, the transactional matrix
  boundary, and rollback-script scoping; focused Vitest result: 3/3 PASS.
  `npm run lint`, `npm run build`, and `git diff --check` also pass. These
  checks do not substitute for the QA execution above or Production gates.
- Rollback candidate:
  [`P0_PRODUCTION_ROLLBACK_20261105.sql`](P0_PRODUCTION_ROLLBACK_20261105.sql).
  SHA-256: `E35525F047C0F5AF022699A53861CDAE6A5CD831A7581AA84F3BF03184E61B58`.
  It restores the captured pre-P0 policy names/predicates, effective table ACL,
  and exact four RPC execute-ACL shape; it removes only the P0 helper. It is
  intentionally security-regressive and has not been executed or validated.
  It is a compensating SQL transaction, not a data restore or a proven backup.
- Backup gate: physical backups reportedly exist, but restore has not been
  verified. The rollback SQL does not close that gate.
- P0 QA checks are complete for the exact hashes and transaction recorded
  above. Before Production, verify a restorable backup and run a fresh read-only
  identity/ledger preflight immediately before any separately authorized
  Production transaction. `db push` remains locked and is not part of this
  package.

## V3 ordering constraint (PR #28 remains unchanged)

- PR #28 remains deferred. Its unmodified N55 `SECURITY DEFINER`
  `confirm_expense_capture(..., 'CREATE_NEW', ...)` path checks active staff but
  does not restrict the financial role before inserting into expenses.
- The local compatibility worktree contains a candidate guard in both N55
  function definitions and the N56 bridge/reconciliation. Static tests pass, but
  the SQL changes are not runtime-validated and have not been committed/pushed.
- Compatibility worktree head remains `e9c0ec4131cc03d5a4104874f1669b547df2d746`
  with local uncommitted changes. Current guard SQL hashes are
  `1B3F8A32DD099F8428B3006C2D7842548D8633EEA15932F0218EFB50260484B8` for N55
  and `A863C70D0126404AC1C914D0B4C556FE295CC9E508BBE83152DDDBA274565084` for
  its concurrency-aware replacement. The focused source tests pass 6/6; lint
  and build pass. No PostgreSQL execution was done.
- Before any V3 migration application, integrate and validate the role guard
  within the N55 definition that runs before expense insertion, and preserve the
  restrictive financial bridge across N56. Grant hardening follows N56; P0
  reconciliation remains last. This blocks the N56-to-P0 interval from
  temporarily permitting non-financial writes.
- A later `db push` cannot be used until migration history reconciliation is
  explicitly cleared; production's existing 28-row ledger is the source of
  truth and must not be repaired or rewritten as part of these packages.

## Suggested independent order

1. Preserve the QA evidence above; do not repeat the remote matrix absent a
   concrete regression or new exact authorization.
2. Verify a recoverable Production backup and current target identity. Obtain
   owner authorization naming the exact P0 SHA and one transaction.
3. Apply only P0 against the current schema, with the preflight and in-transaction
   postchecks; stop on any drift. Do not use `db push`.
4. Release PR #34 independently only after current PR CI/Preview evidence is
   refreshed and the owner authorizes merge/deploy; P0 remains a separate gate.
5. Integrate V3 only after N55's guard and N56's restrictive bridge are
   validated, then reconcile migration history before any incremental deployment.

No Production gate is passed by this preparation. Remaining gates are a
verifiably restorable Production backup, fresh read-only target/ledger
preflight, resolution of PR base drift and the migration-history mechanism, and
a separate owner authorization naming the exact P0 commit and one Production
transaction. The QA result does not authorize any Production action.
