# RLS and RPC Write Path Fix — 2026-07-21

## Scope

- Initial HEAD: `66a32d9a639ba83262a92da5d2e53e92fbbe0cda`.
- Applied database target: QA `kpvvydthlxupjjqqdpxy` only.
- Test marker: `QA_RLS_FIX_20260721`.
- During the QA implementation block, production, production Auth, financial writes, invoices, payments, closings, fiscal numbering and `financialWriteApi` were untouched. The verified migration was later released to production under the separate 2026-07-22 gate documented below.

## Current-state audit

RLS was enabled on `clients`, `properties`, `jobs`, `job_lines`, `quote_lines` and `leads`. The three target tables exposed unconditional `anon` SELECT/INSERT/UPDATE policies. They had broad table grants, so RLS was the effective row gate.

No `owner_id`, `user_id`, `company_id` or `tenant_id` exists on clients, properties or jobs. QA has one auth user and no application-role metadata. Consequently, an `authenticated USING (true)` policy cannot express ownership and would expose every row to every authenticated account.

Existing RPC observations:

- `save_job_with_lines`: SECURITY DEFINER with fixed search path and an internal `auth.uid()` guard, but EXECUTE was still granted through public/anon.
- `reassign_property_client`: SECURITY DEFINER with fixed search path, no internal auth guard, and public/anon/authenticated EXECUTE.

Private evidence lives under `qa-reports/private/rls/` and is intentionally ignored by Git.

## Strategy selected: Option B — authenticated RPCs

Direct REST writes were not opened to `authenticated`. The schema lacks a safe row-ownership predicate, so RPCs provide the smaller public surface:

- allowlisted payload fields;
- mandatory authenticated session through `auth.uid()`;
- relationship and status validation;
- SECURITY DEFINER plus fixed `search_path`;
- EXECUTE revoked from public/anon and granted to authenticated;
- exact JSON row returned for reconciliation.

The migration also removes the obsolete anon INSERT/UPDATE policies from clients, properties and jobs. Their existing anon SELECT policies are retained because reads are outside this sprint and the current app read layer depends on that contract.

## Migration

Created:

- `supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql`

Functions added:

- `require_authenticated_write()`
- `create_client(jsonb)`
- `update_client(jsonb)`
- `create_property(jsonb)`
- `update_property(jsonb)`
- `update_job_status(text, text)`
- `reassign_property_client_authenticated(text, text)`

Existing functions hardened:

- direct EXECUTE on `reassign_property_client` removed from public, anon and authenticated; the authenticated wrapper is the supported entry point;
- public/anon EXECUTE removed from `save_job_with_lines`; authenticated remains allowed.

Policies removed:

- anon INSERT/UPDATE on `clients`;
- anon INSERT/UPDATE on `properties`;
- anon INSERT/UPDATE on `jobs`.

The migration is idempotent through `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, repeated-safe REVOKE/GRANT statements and one transaction. It was applied to QA with PostgreSQL 17 `psql`; `db push` was not used and production migration history was not touched.

## Frontend write paths

- Client create/update now use `create_client` / `update_client` with the authenticated helper.
- Property create/edit now use `create_property` / `update_property`.
- Property reassignment uses `reassign_property_client_authenticated`.
- Quick job status uses `update_job_status`.
- Full job create/edit keeps `save_job_with_lines`.
- Every path retains anon only as `apikey`; bearer remains `session.access_token` and missing sessions fail before fetch.
- HTTP success still requires one represented row where applicable.

## Real QA results

| Operation | Before | After |
| --- | --- | --- |
| Create client | REST 403 / RLS 42501 | RPC HTTP 200, persisted |
| Update client | legacy anon REST path | RPC HTTP 200, persisted |
| Create property | REST 403 / RLS 42501 | RPC HTTP 200, persisted |
| Edit property | REST 200, zero rows | RPC HTTP 200, persisted |
| Reassign property | old RPC HTTP 200 but unguarded entry | authenticated wrapper HTTP 200, persisted |
| Create job + line | RPC HTTP 204, persisted | RPC HTTP 204, persisted with restricted grants |
| Change job status | REST 200, zero rows | RPC HTTP 200, persisted |

Auth validation returned HTTP 200. The bearer differed from the anon key. Maximum marker footprint was four rows: client, property, job and job_line.

## Cleanup and protected domains

- `QA_RLS_FIX_20260721`: 0 final rows.
- `QA_AUTH_RLS_WRITE_20260721`: 0 rows.
- `QA_DEMO_20260721`: 15 rows intact.
- invoices/payments/quarterly_closings: `0/0/0` before, during and after verification.
- No service-role credential was used by frontend or HTTP verification.
- No full-submit, invoice emission, payment registration, fiscal close or numbering operation ran.

## Remaining risks

- This is a single-workspace authorization model. RPC authentication prevents anonymous mutation but does not create tenant ownership. Adding a second company or tenant requires an explicit ownership schema and policy sprint before onboarding its users.
- Anon SELECT policies remain on clients/properties/jobs because read-path migration was outside scope. They should receive a separate privacy audit.
- QA was updated by direct `psql`; migration-history reconciliation remains required before any future `db push`.
- Production received the exact verified migration on 2026-07-22. No real production write smoke has been authorized or executed.

## Final validation

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: 43 files, `201/201` tests.
- `npm run qa:sandbox:check`: pass; exact QA fingerprint confirmed.
- Migration second apply: pass, confirming idempotence in QA.
- `npm run qa:visual:auth`: `360/360` across mobile, tablet and desktop.
- `node scripts/qa/run-end-user-flow-agent.mjs --mode=dry-run`: `588/588`, 3 policy skips, 0 entities created.
- Final `qa:rls-fix:verify-clean`: pass; both temporary markers 0, seed intact, financial tables `0/0/0`.

## Production release — 2026-07-22

The separate production gate passed and applied this exact migration to production ref `wfxnwfcdjainpojhbdri` after target validation and a private schema-only backup. PostgreSQL 17 `psql` used `ON_ERROR_STOP` and the migration transaction; `db push` and all other migrations remained prohibited. Post-apply catalog verification confirmed RLS, six authenticated RPCs, hardened legacy grants, removal of the six anon write policies, and zero unsafe authenticated write policies. The deployed frontend bundle contains the coordinated RPC paths. No real write smoke, invoice, payment, closing, numbering, Auth, or full-submit operation ran.

Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).

## Rollback

Repository rollback: `git revert <commit-of-this-sprint>` followed by lint, build and tests.

QA database rollback requires a separately reviewed `psql` transaction that drops the seven new functions, restores the previous function grants and recreates the six removed anon write policies. Production rollback is specified in [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md), requires an explicit operational decision, and deliberately restores the insecure legacy surface. No data rollback is currently needed.
