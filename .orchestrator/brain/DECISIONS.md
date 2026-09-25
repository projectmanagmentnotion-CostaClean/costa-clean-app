# Decisions

## D-M2-001 — Use GitHub main as canonical base

The remote symbolic HEAD resolves to `main` at `368ed1f75ecda0c0f383c6df4ccffee216db76ce`. The isolated M2 worktree is based on that commit. The original local branch and its unpublished state are not canonical.

## D-M2-002 — Keep migration documentation-only

M2 changes only `.orchestrator/brain/` in the isolated worktree. No application source, Supabase migration, Vercel configuration, GitHub workflow, or environment file is changed.

## D-M2-003 — Treat historical status claims conservatively

Prior documentation and source-thread reports are evidence references. They are not current completion proof unless independently tied to the canonical snapshot and a future accepted gate.

## D-M2-004 — Block execution pending review

The Brain is structurally valid but execution readiness is `NOT_READY_STRATEGIC_REVIEW`. A later task must carry the accepted Brain context and a bounded objective.

# Rejected shortcuts

- Do not resolve the original active rebase automatically.
- Do not use credentials found in configuration.
- Do not infer production or remote health from local configuration.
