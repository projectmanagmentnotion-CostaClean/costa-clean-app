# Codex Final Closeout Agent

This file is the versioned instruction source for Codex to continue the final closeout roadmap. It exists in the repository because `.project-agent/private/` must not be committed.

## Mission

Read and execute the final closeout roadmap one gate at a time.

Primary files:

- `docs/FINAL_CLOSEOUT_ROADMAP.md`
- `docs/FINAL_CLOSEOUT_CHECKLIST.md`
- `docs/DB_PUSH_LOCK.md`
- `docs/SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md`
- `docs/APP_QUALITY_GATES.md`
- `docs/RISK_MAP.md`
- `docs/CODEX_WORKFLOW.md`

## Execution rules

1. Treat Gate 1 documentary work as delivered by commit `bca5189209a4e7662164af803754a5b759ac1a9e`; do not recreate its manifest or repair plan.
2. Do not skip gates.
3. Do not repeat gates already closed.
4. Do not execute `db push`.
5. Do not execute real migration repair without explicit authorization.
6. Do not touch Supabase production without an explicit production gate.
7. Do not touch official Supabase QA unless a gate explicitly authorizes it.
8. Do not touch invoices, payments, fiscal closings, `invoice_number`, fiscal `display_code`, fiscal sequences or full-submit.
9. Do not use `service_role` in frontend code.
10. Do not print or commit secrets, connection strings, dumps, cookies, storage state or private artifacts.
11. Commit and push after each completed versionable gate.
12. Stop if a gate needs credentials, a disposable Supabase project, production access, migration-history writes or another explicit authorization.

## Current external block

Gate 1 is closed at the documentary boundary and blocked before disposable proof. The manifest, repair plan and `proof: NO` status document already exist. Gate 2 remains blocked and must not advance.

Expected behavior:

- Do not repeat the migration manifest or repair plan.
- Request exactly: a third disposable Supabase project/branch ref distinct from official QA and production; a private operator/DB credential delivered through a private channel; a proven discard or restore mechanism for that exact target; and explicit authorization for schema and migration-history writes only on that disposable target.
- Attempt a disposable proof only after all four items are present and the ref is explicitly confirmed not to be production or official QA.
- Until then, stop at the external-resource boundary and keep Gate 2 blocked.
- Do not simulate proof.
- Keep `db push` explicitly locked.

## Completion format

Each completed gate must report:

1. HEAD inicial/final.
2. Gate executed.
3. Files created/updated.
4. Validation results.
5. Production modified: YES/NO.
6. Official QA modified: YES/NO.
7. Schema/data modified: YES/NO.
8. Secrets versioned: 0.
9. Commit/push.
10. Next active gate or blocking authorization/resource.
