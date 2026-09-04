# Costa Clean Local Repository Inventory

Audit date: 2026-09-04

## Scope and method

The audit used the repository's Git metadata, registered worktrees, local file inventory, and the visible remote refs. No checkout, reset, clean, rebase, automatic stash, Supabase write, or production action was performed.

The parent directory `C:\Users\USUARIO` is not readable by the current sandbox identity, so discovery is limited to the current repository, Git-registered worktrees, and known sibling paths exposed by Git. This is an explicit audit limitation, not evidence that no other directory exists.

## Repositories and worktrees

| Path | Repository | Remote | Branch | HEAD | State | Purpose |
|---|---|---|---|---|---|---|
| `C:\Users\USUARIO\costa-clean-app` | `projectmanagmentnotion-CostaClean/costa-clean-app` | `https://github.com/projectmanagmentnotion-CostaClean/costa-clean-app.git` | `main` | `a63cb5f069a3ac8f1fd1cd377fac9ee7930a11c2` | clean, tracking `origin/main` | CRM plus integrated client-portal surface |
| `C:\Users\USUARIO\costa-clean-app-portal-baseline` | same repository | same | `fix/portal-test-baseline` | `9ce4e7c07fc0787634c7cda9c0514665566f090a` | clean, tracking origin | frozen portal artifact/EOL baseline |
| `C:\Users\USUARIO\costa-clean-app-invoice-qa` | same repository | same | `fix/invoice-open-document-before-payment` | `f9638c6892108f36f3a105fce8c1fef92333e2a4` | clean, tracking origin | invoice QA worktree; not a portal source |

Additional registered detached audit worktrees are under `.codex/visualizations/...` and are not product branches. They were not modified.

## `codex/portal-clientes-main`

This name was not found in local heads, remote heads, or the registered worktree list. It is therefore not currently evidenced as a branch, worktree, local-only ref, or remote ref.

## Current repository state

- Root: `C:/Users/USUARIO/costa-clean-app`
- Current branch: `main`
- Upstream: `origin/main`
- Dirty: no
- Staged files: none
- Untracked files: none before this audit report
- Local-only commits on `main`: none
- Remote-only commits relative to local `main`: not evidenced by local refs; direct `git ls-remote` was blocked by unavailable Git credentials, while GitHub API refs were readable
- Stashes: `stash@{0}` `temp-before-rebase-vercel`; not applied or modified
- Work lost: none evidenced

## Related product discovery

No local or remote `costa-clean-web` project was found in the Git-visible scope. The public website is a WordPress/SiteGround installation, not this repository. The repository contains the CRM and portal code under `src/portal`, not a standalone public marketing web project.

## Preservation result

PASS. The identified portal baseline worktree is clean and already tracked remotely. No preservation branch or commit was created because there was no uncommitted local portal work to protect and creating one would add unnecessary repository state.

