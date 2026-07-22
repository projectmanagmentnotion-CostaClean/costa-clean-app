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
- `docs/GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md`

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

## Current active authorization — Gate 4B

Gate 4B is now explicitly authorized for autonomous execution exclusively in Supabase QA `kpvvydthlxupjjqqdpxy` under the exact scope, provider rules, credential handling, stop conditions and verification requirements in [GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md](GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md).

The owner authorizes Codex to inspect the real hosting, deployment and DNS configuration; reuse or provision a stable QA hostname under the app's actual domain; create a Cloudflare Turnstile Managed widget when authenticated provider access exists; install QA-only frontend and Edge Function configuration; implement the approved Edge Function/private RPC/migration architecture; run local proof; apply and verify only in QA; clean synthetic data; document; commit; push; and reactivate continuation.

Do not ask for values that can be discovered or provisioned safely through existing authenticated local sessions. Stop only for the smallest unavoidable human-only action such as login, MFA, email verification, account creation, billing acceptance or missing provider access. Never print or commit secret values.

Production `wfxnwfcdjainpojhbdri`, Gate 4C, `db push`, financial/fiscal writes, full-submit, paid overage and unrelated changes remain forbidden.

## Current gate after production metadata repair - 2026-07-22

The production metadata-only repair and Gate 3 are complete. Gate 4A source audit/design is complete with Turnstile + Edge + private RPC recommended. Gate 4B is the active execution gate under the authorization above. Gate 4C production requires a later independent authorization. Do not repeat prior gates or infer that `db push` is safe. Evidence: [PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md](PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md).

## Historical production metadata block - superseded 2026-07-22

The QA metadata repair and authorization package were followed by a separately authorized production metadata-only repair, now complete. Preserve the package as historical evidence; do not repeat the package, repair or rollback. `db push` remains a later independent and locked gate.

## Historical Gate 1/2 external block and current residual

Gate 1 has a passing local disposable PostgreSQL proof. The remote disposable Supabase proof remains deferred because the free plan could not provide a third project; the local evidence is not Supabase Cloud equivalence. Later QA and production metadata-only repairs were independently authorized and completed. Their completion does not prove a safe CLI zero-SQL plan, so `db push` remains locked. The production metadata smoke also retains unrelated `358/360` visual/harness debt.

Expected behavior:

- Do not repeat the migration manifest or repair plan.
- Treat `npm run qa:migrations:local-proof` and its versioned report as proof only of PostgreSQL syntax, bootstrap order, fingerprints and simulated metadata.
- Defer the third-project Supabase proof while the account limitation remains.
- Never infer future authorization from the passing local proof or completed metadata gates.
- Do not simulate proof.
- Keep `db push` explicitly locked.

Current continuation:

- Gate 3: complete; do not reopen tenancy implementation without separate schema/Auth/policy authorization.
- Gate 4A: complete, source-only.
- Gate 4B: explicitly authorized and active under `docs/GATE_4B_AUTONOMOUS_EXECUTION_AUTHORIZATION_20260722.md`.
- Gate 4C: production blocked until Gate 4B QA PASS and separate authorization.
- Gate 5: later; do not begin it during Gate 4.

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
