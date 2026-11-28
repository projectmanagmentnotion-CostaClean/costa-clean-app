# Expense receipt Storage P0 (Production-compatible, not applied)

## Scope and authorization boundary

Migration `20261125164758_secure_expense_receipt_storage_p0.sql` is independent
of the pending V3 migration chain. It uses only the Production contracts
verified for this change: `public.expenses(id, receipt_file_path)`,
`public.expense_staff_access(boolean)`,
`app_private.internal_staff_role_can_write_financially(text)`, and
`storage.objects` with RLS enabled. The migration has not been applied to QA or
Production.

## Live catalog evidence (2026-11-26)

Production's four bucket-only policies were confirmed by read-only catalog
queries. `public.expense_staff_access(boolean)` resolves the authenticated
identity with `auth.uid()`, requires an active, non-revoked row in
`public.internal_staff_memberships`, and delegates financial writes to
`app_private.internal_staff_role_can_write_financially(text)`, which allows
`owner`, `admin`, and `finance`. Both functions use an empty search path;
the membership table has RLS forced on. The migration uses this existing
contract and does not depend on the pending V3 tables.

The same read-only preflight counted 61 `expense-receipts` objects: 54 match
an expense's current receipt pointer and 7 are unlinked. Fifty-two use the
canonical UUID expense-folder shape; 9 use other `expenses/` shapes, including
7 linked noncanonical paths. The V1 client builds new paths as
`expenses/<expense UUID>/<ISO timestamp>-<sanitized filename>`. Receipt
replacement uploads the new file, persists the new pointer, then attempts to
remove the previous object. The migration therefore preserves reads of any
exact current pointer for active staff, and financial-role deletion of the
exact current pointer; unlinked objects remain inaccessible. No object names
or file data were retrieved for this inventory.

QA's previously observed N51 `captures/<session-id>/...` policies and
`public.expense_capture_sessions` contract are not part of Production's
prestate. This Production-focused migration intentionally has no N51 capture
branch. Do not apply it to QA: it would intersect with restrictive guards and
deny the separate capture namespace until a separately tested compatibility
migration is approved. No remote migration has been applied.

## Backup readiness (2026-11-26)

The authenticated Production dashboard listed physical daily database backups,
including one dated 2026-11-26 03:32:56 UTC and earlier daily entries. This
confirms a recent scheduled backup exists, but does not prove that this newest
backup has been restored successfully. Supabase states on the page that these
database backups do not include Storage objects.

The private local vault contains an encrypted database archive and manifest
from 2026-11-13. Its local restore was previously verified, but it is older
than the current daily backup. The same vault contains an independently
encrypted Storage archive whose 61 objects were previously recovered and
integrity-checked; the archive is also from 2026-11-13. The current catalog
count is 61, but object identity against that older archive has not been
verified. Two `.partial` database-export files also remain in the vault and
are not valid backups. No local files were opened or removed in this check.

Before any Production application, inspect the current scheduled-backup entry
and its restore availability without selecting Restore. To verify recoverability
of that exact point in time, use the official Restore to New Project flow only
after separate approval of the new-project cost and data-clone risks; restore
to an isolated project, validate the database schema and migration ledger,
and verify Storage independently from an encrypted object archive and its
manifest. Do not treat database backup availability as Storage recovery.

## Remaining test artifact

The existing release note reports four skipped tests but does not enumerate
their names. The configured Vitest suite contains three `skipIf` cases for
live QA PostgreSQL checks. The conditional Playwright skip in
`tests/e2e/v3-release.spec.mjs` is outside the Vitest include patterns and
cannot be attributed as the fourth. The fourth skip remains unverified until
the original detailed reporter output is available; do not rerun the full
suite solely to identify it.

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
- Replacement updates the pointer before deleting the previous file, so the
  previous object can be removed after the pointer moves only when it follows
  the canonical existing-expense path. A noncanonical historical path becomes
  inaccessible after pointer movement and may remain as an unlinked object;
  the UI reports cleanup separately from the successful replacement. Do not
  broaden Storage access to compensate.

## Local synthetic validation

The validated test uses PostgreSQL 17 initialized as a temporary local
cluster, bound only to `127.0.0.1` on an ephemeral port, with synthetic users,
memberships, expenses, Storage rows, and the four known broad policies. On
2026-11-26, both the P0 policy matrix and replacement cases passed; the cluster
was stopped and its temporary data directory removed. To repeat from the
repository root on a machine with PostgreSQL 17 binaries:

1. Start a disposable cluster using `initdb` with a temporary data directory,
   trust authentication, and no external listener. Do not use an existing
   PostgreSQL data directory.
2. Start it with `listen_addresses=127.0.0.1` on a free local-only port.
3. From the repository root, run
   `psql -X -h 127.0.0.1 -p <port> -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/qa/expense_receipt_p0_prestate.sql`.
4. Run
   `psql -X -h 127.0.0.1 -p <port> -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/qa/expense_receipt_p0_security.sql`.
5. Stop the exact temporary cluster and remove only its temporary directory.

The local prestate is Production-equivalent for this migration and intentionally
does not include QA N51 capture policies or `expense_capture_sessions`. It
validates PostgreSQL RLS/policy behavior with synthetic identities and data; it
is not a Supabase Storage API test and does not exercise the Supabase
`storage.protect_delete()` trigger or signed-URL service. QA does not need this
Production-only migration; do not apply it there to obtain this evidence.

The role matrix includes owner, finance, admin, operator, readonly,
authenticated non-member and anon. Replacement checks prove that canonical
historical objects can be cleaned after pointer movement and that noncanonical
historical objects become inaccessible rather than bypassing the P0 guard.

The synthetic fixture models only the verified Production authorization
contract. It is not a QA N51 fixture and must not be treated as one.

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
5. The Production migration itself has no Storage-object writes. Use the
   existing local synthetic RLS evidence for positive/negative role behavior;
   run any end-to-end Storage API writes only in an isolated QA-compatible
   environment with separate approval. Do not apply this migration directly
   to QA while its N51 capture policies are present.

## Recovery

Before commit, any preflight or postcheck failure rolls back the transaction
automatically. After a successful commit, do not restore the old bucket-only
policies: that would reinstate the exposure. If an application regression is
found, disable the affected UI operation if necessary and prepare a forward
fix that keeps restrictive guards in place. A true catalog rollback that
recreates the old policies requires explicit owner security-risk approval and
is not the recommended recovery path.
