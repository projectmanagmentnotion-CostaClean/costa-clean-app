# Security

## M2 boundary

This migration is local and documentation-only. No credentials were read or used. Secret-looking values are not copied into the Brain or logs.

## Approval classes

SAFE_AUTONOMOUS is limited to read-only inspection, local documentation edits in the authorized M2 worktree, local validation, and local audit artifacts.

APPROVAL_REQUIRED includes push, PR, merge, protected-branch changes, deployment, Supabase production migration or data changes, secrets, DNS, billing, destructive deletion, real email, financial operations, and any remote or production side effect.

The policy is extensible, but an action must never be downgraded to SAFE_AUTONOMOUS for convenience.

## Costa Clean restrictions

Do not access production by default. Preserve auth, Supabase, invoices, quotes, clients, services, and existing routes when future work is authorized. Follow `AGENTS.md` and the mandatory documentation set before code changes.

## Audit requirements

Every future execution must record the project identity, Brain hash, baseline HEAD, task, action classification, report, and approval evidence. Crash or process disappearance is not completion evidence.
