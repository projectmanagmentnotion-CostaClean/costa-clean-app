# Production RLS/RPC Release Gate — 2026-07-22

## Result

- Release result: applied and catalog-verified.
- Production Supabase project ref: `wfxnwfcdjainpojhbdri`.
- Authorized migration: `supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql`.
- Migration SHA-256: `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2`.
- Apply method: PostgreSQL 17 `psql`, `ON_ERROR_STOP`, using the migration's explicit `BEGIN` / `COMMIT` transaction.
- `db push`: not used.
- Other migrations: not applied.
- QA: not mutated or revalidated during this release block.

## Preflight

Repository preflight:

- Initial HEAD: `bf854e4d143138a619eb556f382d2e18e1c1fb68`.
- `main` and `origin/main`: synchronized before apply.
- Worktree: clean before release documentation.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test`: 43 files and `201/201` tests passed.

Migration review:

- The file matches the QA-verified commit and hash.
- It changes only authenticated operational functions, grants, and legacy anon write policies associated with clients, properties, jobs, and the existing job/job-line save RPC.
- It contains no references to `invoices`, `payments`, `quarterly_closings`, `invoice_number`, `display_code`, `financialWriteApi`, or `service_role` credentials.
- It does not add `authenticated USING (true)` policies.
- New RPCs are `SECURITY DEFINER`, use fixed `search_path = public, pg_temp`, and call an internal `auth.uid()` guard.

Target validation:

- The public Supabase URL ref and private pooler username ref both resolved to `wfxnwfcdjainpojhbdri`.
- The target differs from QA `kpvvydthlxupjjqqdpxy`.
- The pooler host, PostgreSQL database, TLS requirement, required tables, required columns, RLS state, and dependent functions passed read-only preflight.
- No connection string or password was printed or versioned.

## Private backup

Before apply, a private schema-only export was created at:

`.project-agent/private/production-release/prod-schema-before-rls-20260722.sql`

- Size: 278388 bytes.
- SHA-256: `119940B0768BC04F3508B5517D8E27852C80295F69C95046332EFC9B6CE35EEA`.
- Safety review: zero `COPY`, `INSERT`, `setval`, or owner statements.
- The `service_role` text found in the dump consists only of standard PostgreSQL/Supabase role names in extension DDL, not credential values.
- The export and all connection evidence remain ignored by Git.

## Apply

The authorized migration was applied once to production with:

- exact project-ref guard;
- exact migration SHA-256 guard;
- required backup existence and size guard;
- PostgreSQL 17 `psql`;
- `ON_ERROR_STOP=1`;
- the single transaction contained in the migration;
- private stdout/stderr logs.

The command exited with status 0. No application row was created, updated, deleted, or queried for business content.

## Post-apply verification

Read-only catalog introspection confirmed:

- RLS remains enabled on `clients`, `properties`, `jobs`, and `job_lines`.
- Six of six new operational RPCs exist, are `SECURITY DEFINER`, have fixed `search_path`, call `require_authenticated_write()`, deny `public/anon`, and allow `authenticated`.
- `require_authenticated_write()` contains the `auth.uid()` check and is not executable by `public`, `anon`, or `authenticated` directly.
- `reassign_property_client_authenticated()` is the allowed authenticated wrapper.
- Direct EXECUTE on legacy `reassign_property_client()` is denied to `public`, `anon`, and `authenticated`.
- `save_job_with_lines()` denies `public/anon`, allows `authenticated`, and calls the existing `require_authenticated_financial_write()` guard.
- The existing job-save guard remains `SECURITY DEFINER`, contains `auth.uid()`, and denies `public/anon`.
- All six legacy anon INSERT/UPDATE policies on clients, properties, and jobs are absent.
- Unsafe global authenticated write policies: 0.
- One pre-existing authenticated `USING (true)` policy remains for SELECT on `job_lines`; it is read-only and outside this write-path migration.

The public production deployment was checked without authentication or writes. All 121 referenced JavaScript chunks were scanned, and the deployed build contains the six new RPC paths plus `save_job_with_lines`; database and frontend contracts are coordinated.

## Protected domains

- Real authenticated write smoke test: executed successfully under separate authorization with marker `PROD_RLS_SMOKE_20260722`.
- Invoice operations: 0.
- Payment operations: 0.
- Quarterly closing operations: 0.
- Invoice emission: no.
- Payment registration: no.
- Fiscal numbering changes: no.
- Full-submit: no.
- `financialWriteApi` modifications: none.
- Production Auth modifications: none.

## Real authenticated non-financial smoke

The separately authorized production smoke targeted `wfxnwfcdjainpojhbdri` and explicitly rejected QA `kpvvydthlxupjjqqdpxy`. It used a real production `session.access_token`; the bearer was verified to differ from the anon key.

- `create_client`: HTTP `200`; the marked row and its automatic `CLI-*` code were persisted and verified.
- `create_property`: HTTP `200`; the marked row and its automatic `PRO-*` code were persisted and verified.
- `update_property`: HTTP `200`; the safe city/notes edit was persisted and verified.
- `save_job_with_lines`: HTTP `204`; one marked job, one marked job line, and the automatic `JOB-*` code were persisted and verified.
- `update_job_status`: HTTP `200`; status `in_progress` was persisted and verified.

Cleanup ran immediately in foreign-key order `job_lines -> jobs -> properties -> clients`, restricted to deterministic IDs carrying `PROD_RLS_SMOKE_20260722`. Post-clean reconciliation found zero marker rows and zero deterministic IDs. No invoice, payment, quarterly closing, fiscal-numbering, or full-submit endpoint was called.

The single consumed `CLI-*`, `PRO-*`, and `JOB-*` values create expected sequence gaps. These codes are operational, not fiscal; the sequences were not and must not be reset. No invoice `display_code` or `invoice_number` was read or written.

## Rollback

Rollback is not currently required. If catalog verification, live monitoring, or a separately authorized smoke reveals a regression, first pause affected operational writes and coordinate the frontend. Then apply this reviewed transaction to production with the same project-ref, backup, and `ON_ERROR_STOP` guards:

```sql
begin;

drop function if exists public.reassign_property_client_authenticated(text, text);
drop function if exists public.update_job_status(text, text);
drop function if exists public.update_property(jsonb);
drop function if exists public.create_property(jsonb);
drop function if exists public.update_client(jsonb);
drop function if exists public.create_client(jsonb);
drop function if exists public.require_authenticated_write();

create policy "Allow public insert access on clients"
  on public.clients for insert to anon with check (true);
create policy "Allow public update access on clients"
  on public.clients for update to anon using (true) with check (true);
create policy "Allow public insert access on properties"
  on public.properties for insert to anon with check (true);
create policy "Allow public update access on properties"
  on public.properties for update to anon using (true) with check (true);
create policy "Allow public insert access on jobs"
  on public.jobs for insert to anon with check (true);
create policy "Allow public update access on jobs"
  on public.jobs for update to anon using (true) with check (true);

grant execute on function public.reassign_property_client(text, text) to public, anon, authenticated;
grant execute on function public.save_job_with_lines(jsonb, jsonb) to public, anon, authenticated;

commit;
```

This rollback deliberately restores the insecure anonymous write surface and must not be run as a routine fix. Prefer correcting a verified RPC defect forward when safe. The private pre-apply schema dump is the authoritative structural reference. Repository documentation rollback is `git revert <release-commit>`; it does not roll back the production database.

## Remaining risks

- Authentication protects the write entry points, but clients/properties/jobs still lack tenant ownership columns. The solution is appropriate only for the current single-workspace model.
- Anonymous SELECT policies remain unchanged and require a separate privacy/read-path audit.
- Direct `psql` application does not reconcile `supabase_migrations.schema_migrations`; `db push` remains blocked until a dedicated history-reconciliation gate.
- The marked production smoke verified the five authorized operational RPC calls and immediate cleanup. Residual application risk is no longer the absence of a production write probe, but the single-workspace authorization model and the separate anonymous read surface.
