# P0 / N56 financial-policy compatibility

Status: local preparation only. No remote SQL, ledger, PR, or deployment was
changed by this compatibility work.

## Why the bridge exists

The original N56 migration drops and recreates `Internal staff insert` and
`Internal staff update` with an active-internal-staff predicate. That is broader
than the certified P0 financial contract (`owner`, `admin`, and `finance`). If
N56 runs after P0, it replaces P0's narrow policies. If it runs before P0, its
wide policy is present until P0 runs. The new bridge avoids either interval in
the expense-table write boundary without changing the original N56, grant
hardening, or P0 SQL files.

## Prepared order

1. Apply pending V3 migrations whose exact Production equivalence is not proven,
   in their reviewed dependency order. The five Production-equivalent source
   files remain excluded from replay; their ledger aliases still need a
   separately approved migration-history mechanism.
2. Apply
   `20261002165959_p0_expense_financial_guard_before_n56.sql` immediately before
   N56. It checks the expected table, membership columns, helper, RLS and role
   preconditions; revokes anonymous/destructive expense grants while preserving
   authenticated read/create/update and service-role CRUD; and installs two
   restrictive financial-write policies. It also revokes the four named legacy
   SECURITY DEFINER RPCs if present.
3. Apply the original N56 SQL unchanged, then original grant hardening unchanged.
   N56's permissive policies cannot override the restrictive bridge.
4. Apply
   `20261002173001_p0_expense_financial_guard_reconcile.sql`. In one transaction
   it requires the exact five-policy guarded prestate, rewrites N56's insert and
   update predicates to the P0 financial predicate, then removes the bridge.
   Any drift raises an exception and rolls back the transaction.
5. Apply the original certified P0 migration unchanged. Its existing cleanup
   removes/recreates the three expected policies and its prestate assertion
   rejects unknown policy residue.

Storage objects, policies, grants, and buckets are not touched by either
compatibility migration. N56's existing Storage behavior remains a separate
release contract and still requires pre/post verification.

## Release-order limits

The P0-only PR is a viable priority release candidate because its branch is
independent of the 257-file V3 PR. That does not make either remote apply
authorized or ready: `DB_PUSH_LOCK.md` still blocks database writes, Production
restore has not been rehearsed, and the CLI cannot infer the five remapped
equivalences from names or statement hashes alone.

Until either the P0-only change or the pre-N56 guard is applied, Production
remains in its observed prestate; the guard does not retroactively protect the
earlier V3 migrations. This is why the independent P0 release is the shortest
security-priority path, subject to its own backup and production gates.

After P0 is in Production, V3's older, unregistered versions require an
explicit include-all/curated application path. A standard `db push` is not
certified to skip the five equivalent files safely. No workaround may rewrite
the ledger or replay those files without an approved exact mapping. The
pre-N56 guard is compatible with P0 already being present: it remains
restrictive when N56 replaces its permissive policies, and the reconciliation
migration independently narrows the N56 policies before removing the guard.

The V3-first alternative is also secure for `public.expenses` only when the
guard immediately precedes N56 and the reconciliation runs before P0. No
representative PostgreSQL/Supabase database was available in this work block,
so SQL behavior, transaction rollback, role matrix, and RPC effects remain
unverified locally. Static tests do not certify SQL execution.

## Required pre-Production gates

- Exact Production identity, complete ordered SQL allowlist, migration-history
  mapping for the five equivalent files, and a zero-unexpected-SQL release
  preflight.
- A fresh physical database backup and successful isolated restore rehearsal;
  separately protect/restore required Storage object bytes and verify checksums.
- Execute both migration order paths on a representative isolated clone with
  synthetic identities for anon, authenticated without membership, operator,
  readonly, owner, admin, finance, and service_role. Verify SELECT/INSERT/UPDATE/
  DELETE/TRUNCATE/REFERENCES/TRIGGER/EXECUTE, RLS, transaction rollback, RPC
  callers, and unchanged Storage policy/grant fingerprints.
- Production authorization for the exact migration hashes, reviewed apply
  order, backup/restore evidence, release window, and postchecks. Merge and
  Production deployment approvals remain separate.

Rollback must not blindly restore broad expense grants/policies. If a postcheck
fails, stop new app traffic affecting expense writes, preserve the restrictive
policy boundary, and use an owner-reviewed forward repair. Restoring database
and Storage backups is a separately authorized incident action because it may
replace newer business data.
