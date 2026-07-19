# Write-and-clean Local QA - 2026-07-19

## Initial State

- Initial HEAD: `3bb5ee5e380e8671c6bc1871423379de2acb6851`
- Branch: `main`
- Worktree: clean and synchronized with `origin/main`
- Production evidence remains green at visual `360/360` and dry-run `435/435`; this does not replace the local submit-and-clean gate.

## Configuration Audit

Required public variable names:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`.env.local` was not present on this machine. Git already ignores it through `.env*.local`. `.env.example` already contains the two required names with empty values and contains no real Supabase values.

No value was invented, extracted from production, printed, or committed. A service-role key is prohibited for this flow.

## Execution Result

- local build with Supabase configuration: not run because `.env.local` is absent
- local preview: not started
- local authenticated dry-run: not run
- local write-and-clean: not run
- entities created: `0`
- entities cleaned: `0`
- known QA residue created by this sprint: `0`

The required setup steps are documented in `docs/LOCAL_QA_SUPABASE_CONFIG.md`. Real submit-and-clean remains blocked until an authorized user places the existing public URL and anon key in the ignored `.env.local`, verifies the local authenticated shell, and obtains a green local dry-run.

## Safety Status

- invoice writes: blocked
- payment/cobro writes: blocked
- fiscal writes: blocked
- job/service writes: blocked while cleanup is unavailable
- invoices issued: `0`
- payments/cobros recorded: `0`
- financial writes: `0`
- production records deleted: `0`
- schema, SQL, RPC, migrations, auth, routes, numbering, fiscal logic, and calculations changed: no

## Remaining Gate

Provide the two existing public Supabase values locally without exposing or versioning them, then run local preview, visible authenticated dry-run, and write-and-clean for client, property, quote, and expense. Every created ID must be recorded and every cleanup must affect at least one row.
