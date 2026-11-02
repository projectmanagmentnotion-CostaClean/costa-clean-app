# V3 QA reconstruction package

This directory is an inventory and static preflight only. It is deliberately
outside `supabase/migrations`; it does not register a migration, change the
Production ledger, or invoke Supabase CLI. `applyAllowed` remains `false` until
the source baseline/prestate blockers in the manifest are resolved.

## Proven source and bootstrap order

The only full schema artifact found in this checkout is
`supabase/migrations/20260721_qa_baseline_schema.sql`. Its header identifies it
as a schema-only `public` export, omitting rows, sequence state, owners, ACLs,
and secrets. It includes `public.clients`, but it is not a complete current
Supabase snapshot: Auth/Storage platform objects are absent, and its current
SHA-256 differs from `docs/SUPABASE_MIGRATION_MANIFEST_20260722.md`.

Once a compatible, reviewed, row-free baseline and platform prestate are
available, the intended disposable QA order is:

1. Load the schema-only baseline outside the migration ledger.
2. Establish the exact Production-equivalent core prestate and validate the
   28-entry ledger mapping. The five equivalent PR files are applied once in
   a fresh QA database, not replayed on Production.
3. Apply the thirteen `pendingMigrations` from the manifest in timestamp order.
4. Apply the P0 hardening after N56 and the following expense grant hardening.
5. Run the P0 matrix and compare catalog, effective grants, RLS, RPC, Storage,
   and role behavior with the expected contract.

This order is a prepared sequence, not an execution proof. Production catalog
metadata confirms `clients`, `expenses`, core invoice/job objects, and staff
membership objects exist. It does not expose the full DDL, all ACLs, ownership,
trigger bodies, or storage schema needed to assert exact compatibility. The
current Production catalog also has no `expense_capture_*` tables, as expected
before V3's pending migrations.

## Static validation

Run from this worktree:

```powershell
node scripts/qa/validate-v3-reconstruction-manifest.mjs
```

The validator checks the baseline fingerprint, the 5 + 13 migration inventory,
timestamp order, P0-after-N56 placement, required fixtures, and the repository
`db:push` lock. A PASS proves manifest consistency only; it does not parse or
execute SQL and must not be represented as bootstrap, migration, or security
validation.

No apply command is provided while the source dump mismatch and exact prestate
remain unresolved. A future apply path must require a newly created disposable
target, loopback-only connection, explicit target identity, empty schema/ledger,
and a fail-closed production-reference check before it can be considered.
