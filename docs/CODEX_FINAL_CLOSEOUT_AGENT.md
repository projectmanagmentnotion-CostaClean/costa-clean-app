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

## Current gate after production metadata repair - 2026-07-22

The separately authorized production metadata-only repair is complete and verified. Do not repeat it, do not execute rollback, and do not infer that `db push` is safe. The next active roadmap gate is Gate 3, Workspace / Tenancy / Ownership Security Model, limited to read-only audit and documentation unless a new authorization permits schema, policy, auth or production changes. Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## Current production metadata block - 2026-07-22

The QA metadata repair is complete. A subsequent read-only sprint prepared [PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md) and verified the three incremental postconditions in production without writes. Do not repeat the package and do not execute production repair. Stop with `blocked` until the exact production metadata-only authorization quoted in that package is supplied. Even after an authorized repair, `db push` remains a later independent gate.

## Current external block

Gate 1 now has a passing local disposable PostgreSQL proof. The remote disposable Supabase proof is deferred because the free plan cannot provide a third project. This local evidence is not Supabase Cloud equivalence and does not authorize remote metadata writes. Gate 2 remains blocked until a separate QA-only authorization exists.

Expected behavior:

- Do not repeat the migration manifest or repair plan.
- Treat `npm run qa:migrations:local-proof` and its versioned report as proof only of PostgreSQL syntax, bootstrap order, fingerprints and simulated metadata.
- Defer the third-project Supabase proof while the account limitation remains.
- The next remote gate, if explicitly authorized, must target official QA first, write metadata only, prove zero schema/data changes and retain a private rollback artifact.
- Never infer authorization for QA from the passing local proof; production requires a later distinct gate.
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
