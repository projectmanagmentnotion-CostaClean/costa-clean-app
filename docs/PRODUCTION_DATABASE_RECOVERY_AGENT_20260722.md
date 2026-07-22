# Production Database Recovery Agent

Read first:

- `docs/PRODUCTION_DATABASE_RECOVERY_AUTHORIZATION_20260722.md`
- `AGENTS.md`
- `docs/DB_PUSH_LOCK.md`

## Objective

Restore database availability for the live Costa Clean application using the smallest evidence-backed reversible action.

Authorized production Supabase ref: `wfxnwfcdjainpojhbdri`.

Forbidden QA ref during this incident: `kpvvydthlxupjjqqdpxy`.

## Mandatory order

1. Confirm the Gate 4B continuation is no longer running and no concurrent process can write to Supabase or the repository.
2. Record HEAD, origin/main and worktree state.
3. Inspect the live deployment configuration and prove which Supabase project ref the production build uses. Never print environment values.
4. Check Supabase project status, REST health, Auth health, logs and network bans through authenticated private mechanisms already available on this workstation.
5. When PostgreSQL is reachable, perform read-only inventory and row-count/fingerprint checks to prove whether the existing production data remains present.
6. Diagnose exactly one root cause before making a change.

## Permitted recovery actions

- Resume or restart the same production Supabase project when it is proven paused or stuck.
- Remove only a proven temporary network ban.
- Correct a proven production-hosting mismatch in the Supabase URL or public browser key, using the authenticated provider source, then redeploy the unchanged production build.
- Create private ignored backups before any remote provider change when access is available.

## Do not do

- Do not run `db push`.
- Do not apply migrations or migration-history repair.
- Do not change tables, policies, grants, functions, sequences or business data.
- Do not rotate secrets or credentials.
- Do not restore or replace the database without a new explicit destructive-restore authorization.
- Do not touch QA, invoices, payments, closings, fiscal identifiers or full-submit.
- Do not expose secrets, connection strings, dumps, tokens, cookies or private environment exports.

## Stop conditions

Stop only for login, MFA, provider support, missing production access, a required schema/RLS change, credential rotation, database replacement or destructive restore.

## Verification

After recovery prove, without writes:

- production ref is exactly `wfxnwfcdjainpojhbdri`;
- project, REST and Auth are healthy;
- production tables and existing data remain present;
- the live app targets the production project;
- authenticated representative reads work;
- QA modified: NO;
- schema/data writes: 0;
- financial/fiscal writes: 0;
- secrets versioned: 0.

Write a private incident report containing verdict, root cause, evidence, exact recovery action, before/after health, data-integrity proof, rollback and any human-only blocker. Commit and push only when a bounded repository or hosting-configuration fix was actually required and fully validated.