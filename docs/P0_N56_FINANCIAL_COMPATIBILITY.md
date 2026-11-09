# P0 / V3 N55-N56 compatibility

Status: isolated local candidate only. No remote project, ledger, PR, or
deployment was modified. PR #28 and PR #30 remain untouched.

## Security corrections in this candidate

- Both N55 `confirm_expense_capture` definitions now require an active
  `owner`, `admin`, or `finance` membership before `CREATE_NEW`. The check is
  before idempotency reuse and before any expense insert because the RPC is
  `SECURITY DEFINER` and can bypass the table RLS boundary. `USE_EXISTING`
  remains available to active internal staff and does not write to `expenses`.
- N56 insert/update policies now call the certified
  `public.expense_staff_access(true)` predicate. That predicate is created by
  the pre-N56 bridge on a fresh V3-first chain, or already exists when P0 has
  been applied. N56 fails closed if the function is missing. Its read policy
  and Storage policies are unchanged.
- The P0 expense grants and privileged RPC revocations are not changed here.
  The certified P0 migration is treated as already applied in the current
  Production state and must not be replayed to release V3.

## Valid application paths

### Current Production path (P0 already applied)

1. Resolve the five proven Production-equivalent ledger entries without
   replaying their SQL; the 13 other PR #28 entries remain pending according
   to the reconciled manifest. This release still requires an explicit curated
   migration mechanism because normal `db push` behavior with the older
   unregistered versions has not been proven safe.
2. Apply pending V3 migrations through N55 and the invoice override in their
   reviewed dependency order. N55 `CREATE_NEW` is finance-role-gated.
3. Before N56, require catalog evidence that the existing P0 helper, effective
   grants, RLS, and four RPC revocations match the certified P0 contract. If
   any check differs, stop and roll back.
4. Apply the pre-N56 bridge. Its two `P0 financial guard` policies have names
   distinct from P0's `Internal staff insert/update` policies, so it can run
   after P0 when its exact preconditions pass. It adds a restrictive financial
   boundary and does not re-run the P0 migration.
5. Apply this candidate's N56, then grant hardening. The bridge protects the
   write boundary while N56 replaces the P0 permissive policies; this candidate
   also makes N56's insert/update predicates financial-only. Authenticated
   DELETE/TRUNCATE/other destructive privileges remain revoked.
6. Apply the N56/P0 reconciliation transaction. It verifies the five-policy
   prestate, sets N56 insert/update to the same financial helper, and removes
   the bridge in one transaction. Verify the exact three-policy result, ACL,
   RPC grants, and unchanged Storage contracts.
7. Do not apply the P0 migration again. It is already registered/applied in
   the stated Production prestate.

The bridge fails closed if its own policy names already exist or the certified
role helper differs. This makes both P0-applied and fresh V3-first routes use
the same checked N56 boundary without mutating the original PR #28/#30 files.

### Fresh V3-first test path (no P0 prestate)

Apply the exact Production-equivalent first five SQL files only to construct a
fresh synthetic local state, then the 13 pending V3 files. Apply the bridge,
N56, grant hardening, and reconciliation in that order, followed by the
unchanged certified P0 migration. This is a separate test ordering and does
not describe the current Production ledger.

## Gates and limits

The recorded Production ledger has 28 entries ending at `20260924100831` in
the last catalog snapshot. Five source migrations have exact stored-statement
hash matches at remapped versions; the remaining 13 are absent. The QA-only
baseline is public-schema-only and excludes managed Auth/Storage state,
ownership, ACLs, rows, and sequence state. It is not a faithful current
Production prestate. Therefore a test built from that baseline alone cannot
certify the full Production release.

The local compatibility tests must exercise real PostgreSQL RLS/ACL behavior
with synthetic roles. Static tests only verify source contracts. Storage is
unchanged by the financial guard and reconciliation; its policies, grants,
and required buckets need a separate pre/post comparison. No SQL execution
result is called Production-equivalent without a representative reconstructed
prestate.

Before any Production operation, resolve the five migration-history mappings,
produce a complete reviewed migration allowlist, rehearse database and
independent Storage restoration on an isolated target, and capture pre/post
RLS, grants, RPC, and Storage metadata. No remote action is authorized by this
document.
