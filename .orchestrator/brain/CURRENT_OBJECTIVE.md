# Objective

Review and accept the initial canonical Costa Clean Project Brain, then define one bounded tactical objective for a later phase.

Status: REQUIRES_HUMAN_REVIEW. This is a review objective, not authorization to modify or execute Costa Clean.

# Why

The repository has multiple historical roadmaps, a separate local checkout with an active rebase, and prior thread claims that must not be silently promoted to current truth.

# Scope

- Review the identity and canonical base commit.
- Review the product and architecture summary.
- Review the evidence classifications and uncertainties.
- Confirm security boundaries and the next decision point.

# Out of scope

- Planner or Executor invocation.
- Functional code changes.
- Running Costa Clean tests, builds, migrations, or deployment.
- Supabase, Vercel, GitHub remote, production, secrets, or external side effects.
- Autonomous loops or selection of a multi-sprint plan.

# Acceptance criteria

- A human accepts or corrects the Brain's product interpretation.
- A human accepts or corrects the active gate and first bounded objective.
- Open uncertainties are either resolved with evidence or explicitly carried forward.
- No execution is authorized implicitly by acceptance of the documentation migration.

# Allowed autonomous work

Read-only inspection of the selected worktree, validation of Brain schemas and hashes, local documentation-only edits inside the M2 branch, and local audit reporting.

# Requires human approval

Any Costa Clean code change, test/build execution against the real project, database operation, external service access, push, PR, merge, deployment, secret use, destructive action, or real external side effect.

# Stop conditions

Stop on conflicting project identity, unexpected worktree mutation, secret exposure, attempted remote access, active rebase interference, invalid Brain hashes/schemas, or an objective that is not explicit and bounded.

# Expected verification

Validate the embedded JSON Schemas, load the Brain with the orchestrator loader, verify manifest hashes, review the local commit, and compare the original worktree's branch, HEAD, status, and diff hash before and after migration.
