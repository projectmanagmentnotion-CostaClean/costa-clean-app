# Production Database Recovery Authorization — 2026-07-22

Project: Costa Clean App

Authorized production Supabase project: `wfxnwfcdjainpojhbdri`

Forbidden QA project for this incident: `kpvvydthlxupjjqqdpxy`

## Incident

The owner reports that the production application currently has no usable database access. This document authorizes an emergency, evidence-first recovery focused only on restoring production availability and verifying data integrity.

## Immediate containment

1. Stop any currently running Gate 4B continuation process before starting this incident workflow.
2. Freeze all unrelated QA, migration, deployment and feature work.
3. Preserve the current worktree and all private incident artifacts.

## Authorized actions

Codex may use authenticated local provider sessions, CLIs and ignored private files to:

- inspect the production deployment, hosting environment and DNS configuration;
- inspect the production Supabase project status, health, logs, connection reachability and network bans;
- verify the production app is configured with the exact production project ref;
- perform read-only SQL and REST health checks;
- create private backups or exports before any repair when the database is reachable;
- resume or restart the existing production Supabase project when it is paused or stuck;
- remove a proven temporary network ban affecting the production operator or hosting egress;
- correct a proven production hosting environment mismatch for the Supabase URL or public browser key;
- redeploy the existing production build only when required to apply that exact environment correction;
- verify authenticated read access and production data integrity after recovery;
- document the incident, root cause, before/after evidence and rollback path;
- commit and push only bounded source or documentation changes that are required by the proven repair.

## Prohibited actions

- Do not run `db push`.
- Do not apply migrations or migration-history repair.
- Do not drop, truncate, recreate or replace production tables.
- Do not rotate database passwords, JWT secrets or API keys unless a proven key mismatch cannot be repaired by restoring the existing correct value; stop before any rotation.
- Do not restore a backup over the current production database without a separate explicit destructive-restore authorization.
- Do not modify invoices, payments, fiscal closings, fiscal identifiers, fiscal sequences or business records.
- Do not run synthetic or real write flows.
- Do not touch QA during this incident.
- Do not print, copy, log or commit secrets, connection strings, cookies, tokens, database dumps or hosting environment exports.

## Recovery decision tree

1. **Provider-wide outage:** collect evidence and stop with the incident status; do not make speculative changes.
2. **Project paused or stuck:** resume/restart the same production project, then verify REST, Auth and PostgreSQL health.
3. **Network ban:** remove only the proven ban and verify connectivity.
4. **Production environment points to the wrong project or invalid public key:** restore the exact production project URL/key from the authenticated provider source and redeploy the current production build.
5. **Database healthy but app reads fail:** identify Auth/RLS/API regression. Do not change schema or policies automatically; produce the exact minimal repair plan and stop unless the change is already covered by a previously approved, reversible production authorization.
6. **Project missing, deleted or unrecoverable:** preserve all available backups and stop before creating or switching to a replacement project.

## Mandatory verification

- Exact production ref proven: `wfxnwfcdjainpojhbdri`.
- QA untouched.
- Supabase project status captured without secret values.
- REST and Auth health status captured.
- PostgreSQL connectivity and public table inventory checked when reachable.
- Existing production data presence verified with read-only counts/fingerprints.
- Production app environment ref checked.
- Authenticated production read smoke completed without writes.
- Financial and fiscal writes: 0.
- Schema/data mutations: 0 unless separately authorized after diagnosis.
- Secrets versioned: 0.
- Final report includes exact root cause, repair, evidence, remaining risk and rollback.

## Human-only stop conditions

Stop at the smallest unavoidable step when login, MFA, email confirmation, provider support, billing acceptance or destructive restore approval is required. Do not repeat completed diagnostics after the user performs that single action.
