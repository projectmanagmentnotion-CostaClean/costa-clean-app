# Portal Local/Remote Reconciliation

Audit date: 2026-09-04

## References compared

- Local `main`: `a63cb5f`
- `origin/main`: `a63cb5f`
- `origin/fix/portal-test-baseline`: `9ce4e7c`
- `origin/docs/client-portal-master-roadmap`: `4296645`
- registered worktree `fix/portal-test-baseline`: `9ce4e7c`

## Results

`main` and `origin/main` are identical at the audit point. The name `codex/portal-clientes-main` has no matching ref.

`main...origin/fix/portal-test-baseline` reports 62 commits on the `main` side and 2 on the portal baseline side. The two baseline commits are already represented by merge commit `bb14268` in the history of `main`; the branch remains as a clean historical/QA pointer.

`main...origin/docs/client-portal-master-roadmap` reports 73 commits on the `main` side and 1 roadmap commit on the roadmap branch. The roadmap branch is not merged as a branch, but its implementation-era assumptions are superseded by the later portal commits now present on `main`.

## Portal-only and portal-relevant evidence in `main`

- `src/portal/` contains the authenticated portal surface, access machine, read API, workspace, service area, preview adapter, auth lifecycle, and tests.
- `supabase/functions/portal-*` contains account, service, invoice-download, and member action Edge Functions.
- `supabase/migrations/20260723160000_client_portal_security_boundary.sql` and later portal migrations contain the boundary and reviewed change/request contracts.
- `scripts/client-portal/` contains QA runners, manifests, fixtures, pre/post checks, and concurrency proofs.
- `docs/client-portal/` contains architecture, trust boundary, route, capability, legal, security, and QA documentation.

## Branch-specific conclusions

- Only local: no uncommitted portal implementation was found in the identified worktrees.
- Only in the old baseline branch: the two EOL stabilization commits are historical branch tips; their changes are in `main` through `bb14268`.
- Only in the roadmap branch: the roadmap commit and its branch ancestry are historical documentation; later implementation and security work in `main` supersede the old 55% snapshot.
- Already in `main`: current portal frontend, backend contracts, Edge Functions, manifests, tests, and post-CP-3B work.
- Abandoned/not authoritative: the old assumption that CP-3A was the next implementation block; it is contradicted by current `src/portal` and subsequent commits.
- Not found: a separate public web repository named `costa-clean-web` and a branch/worktree named `codex/portal-clientes-main`.

## PR evidence

- PR #2, `docs: add client portal master completion roadmap`, closed without merge. It added documentation only and was based on `6c6b29a`.
- PR #7, `fix(portal): stabilize frozen artifact tests on Windows`, closed and merged as `bb14268`. It corrected LF/CRLF materialization for byte-pinned portal artifacts without changing hashes, SQL contracts, migrations, or product logic.
- PR #13 is an open draft Stitch visual-parity prototype based on `agent/stitch-fe-02-token-theme-fundamentals`, not a public web repository and not safe to merge without the stated visual approval.

## Comparison limitation

The Git remote transport could not run `git ls-remote` because the sandbox identity has no Git credential for Schannel. GitHub's public API was readable and matched the local remote refs for the relevant branches. No remote write was attempted.

