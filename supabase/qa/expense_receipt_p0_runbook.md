# Expense receipt Storage P0 (Production-compatible, not applied)

## Scope and authorization boundary

Migration `20261125164758_secure_expense_receipt_storage_p0.sql` is independent
of the pending V3 migration chain. It uses only the Production contracts
verified for this change: `public.expenses(id, receipt_file_path)`,
`public.expense_staff_access(boolean)`,
`app_private.internal_staff_role_can_write_financially(text)`, and
`storage.objects` with RLS enabled. The migration has not been applied to QA or
Production.

It does not change buckets, object data, expense rows, Auth users, Storage
configuration, or other bucket policies. Its transaction and pre/postchecks
make a failed run roll back as one unit.

## Access contract

- Active staff (`owner`, `admin`, `finance`, `operator`, `readonly`) can read
  the current receipt path referenced by `expenses.receipt_file_path`.
- `owner`, `admin`, and `finance` can also read canonical historical objects
  under `expenses/<existing-expense-uuid>/...`. This is required because
  Storage upsert and delete need SELECT visibility. Other active staff cannot
  read a stale, non-current pointer.
- Only those three financial roles can insert/update/delete. New inserts and
  updates must use the V1 path format
  `expenses/<UUID>/<ISO-timestamp>-<sanitized-name>.<pdf|jpg|jpeg|png|webp>`
  and reference an existing expense. Delete also permits an exact current
  pointer, preserving the seven observed historical noncanonical linked paths.
- Objects without an existing expense relation remain denied. Production's
  two observed noncanonical unlinked objects are not deleted by this change.
- Four restrictive bucket-scoped guards intersect every permissive policy, so
  an additional broad permissive policy cannot reopen this bucket. The guards
  evaluate to true outside `expense-receipts`, leaving other buckets' own
  policies in control.
- There is no uploader/member identifier in the current expense/path contract;
  this migration cannot enforce per-user ownership. `service_role` bypasses
  RLS by design and is not changed by this migration.
- V1 replacement deletes the old file while it is still the current
  `receipt_file_path`, so its historical noncanonical paths remain deletable.
  The inspected V3 replacement flow updates the pointer before deleting the
  previous file. That sequence cannot delete a historical noncanonical path
  after the pointer moves; the V3 flow must be changed or explicitly reconciled
  before V3 release. Do not broaden access to compensate.

## Local synthetic validation

The validated test used PostgreSQL 17.10 initialized as a temporary local
cluster, bound only to `127.0.0.1:55439`, with synthetic users, memberships,
expenses, Storage rows, and the four known broad policies. The cluster was
stopped and its temporary data directory removed after the run. To repeat from
the repository root on a machine with PostgreSQL 17 binaries:

1. Start a disposable cluster using `initdb` with a temporary data directory,
   trust authentication, and no external listener. Do not use an existing
   PostgreSQL data directory.
2. Start it with `listen_addresses=127.0.0.1` on a free local-only port.
3. From the repository root, run
   `psql -X -h 127.0.0.1 -p <port> -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/qa/expense_receipt_p0_prestate.sql`.
4. Run
   `psql -X -h 127.0.0.1 -p <port> -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/qa/expense_receipt_p0_security.sql`.
5. Stop the exact temporary cluster and remove only its temporary directory.

This validates PostgreSQL RLS/policy behavior with a representative synthetic
contract; it is not a Supabase Storage API test and does not exercise the
Supabase `storage.protect_delete()` trigger or signed-URL service.

## Controlled remote application (requires separate owner authorization)

Do not apply until the exact new migration version is reconciled against the
Production ledger and a current recoverable backup and QA Storage API plan are
approved. Never use `db push` for this release.

1. Confirm the target project/ref is Production and the target ledger does not
   already contain this migration version. Confirm the four broad policy names
   and function/table signatures still match the preflight.
2. Save the catalog state for the target policies and verify the latest backup
   and restore procedure separately.
3. Apply this single migration in one transaction using the approved
   production migration mechanism. Any preflight/postcheck exception aborts
   the transaction.
4. Verify the four old bucket-only policies are absent; all four P0
   permissive policies and four restrictive guards exist; `storage.objects`
   RLS remains enabled; and the helper is `SECURITY DEFINER`, has an empty
   search path, is owned by `postgres`, and is executable only by `anon` and
   `authenticated` (not `PUBLIC`).
5. Through the Storage API, test synthetic uploads, signed reads, upsert and
   delete with owner/finance, then verify operator, readonly, anon, and
   non-member denials. Use QA first under a separately authorized change.

## Recovery

Before commit, any preflight or postcheck failure rolls back the transaction
automatically. After a successful commit, do not restore the old bucket-only
policies: that would reinstate the exposure. If an application regression is
found, disable the affected UI operation if necessary and prepare a forward
fix that keeps restrictive guards in place. A true catalog rollback that
recreates the old policies requires explicit owner security-risk approval and
is not the recommended recovery path.
