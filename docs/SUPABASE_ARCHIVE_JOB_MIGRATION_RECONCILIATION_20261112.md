# Archive job migration version reconciliation — 2026-11-12

## Decision

The migration file is named with the version actually recorded in CostaClean QA. Its SQL bytes are unchanged; this is a path-only reconciliation, not a new SQL migration and not a ledger write.

- Former path: `supabase/migrations/20261111210459_archive_job_internal_staff.sql`
- Reconciled path: `supabase/migrations/20261111214439_archive_job_internal_staff.sql`
- File SHA-256 (unchanged): `1C30484D3944F7556799CD28C1B71D4ADF1434EF3453A8DD6F93695E9984E1DF`
- QA ledger entry: version `20261111214439`, name `archive_job_internal_staff`
- QA catalog check: `public.archive_job(text)` is owned by `postgres`, `SECURITY DEFINER`, `search_path=''`, with explicit EXECUTE for `authenticated` only (plus owner).
- Normalized PL/pgSQL source MD5 in QA and in the local migration body: `fd1a2985f3ba60b6775e11eba7591646`

## Scope and limits

The QA checks were read-only. No SQL was applied or re-executed during this reconciliation; no ledger was changed. The source-body digest and catalog attributes establish the function body and effective ACL/security attributes match the migration. They do not attest to unrelated database objects or provide a complete raw-SQL archive of the original apply operation.

This narrow version alignment does **not** unlock `supabase db push`, migration repair, or any remote operation. The repository-wide migration-history lock and the separate historical migration reconciliation requirements remain in force. Production was not queried or modified.
