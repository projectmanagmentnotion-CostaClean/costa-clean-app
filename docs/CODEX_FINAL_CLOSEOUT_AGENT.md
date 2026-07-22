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
- `docs/GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md`

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
12. Stop if a gate needs production access, financial/fiscal writes, unavailable Supabase QA authentication or another explicit authorization.

## Current active authorization — Gate 4B providerless QA fallback

Gate 4B is explicitly authorized for autonomous execution exclusively in Supabase QA `kpvvydthlxupjjqqdpxy` under [GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md](GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md).

The providerless fallback supersedes Cloudflare Turnstile as a mandatory Gate 4B QA prerequisite. Missing Cloudflare access, Turnstile keys, DNS access or a dedicated QA hostname must not block this QA gate.

Codex may implement the authorized QA-only Edge Function, strict shared contract, HMAC pseudonymous throttling, replay/cooldown storage, private transactional RPC, one reviewed 14-digit migration, frontend integration, tests, local disposable PostgreSQL proof, QA-only apply/deployment, synthetic verification, cleanup, documentation, commit and push.

Use an existing stable QA/staging URL when available. If none exists, validate the frontend through the local QA preview and the deployed Supabase QA Edge Function endpoint. Do not alter the production hostname merely to obtain a QA URL.

Codex may generate the HMAC pepper locally and install it through a private ignored mechanism or authenticated Supabase QA secret command. Never print or commit the value. Stop only if Supabase QA authentication requires an unavoidable human login/MFA step or if the QA identity cannot be proven.

Turnstile remains preferred defense-in-depth for a later production Gate 4C or a separate provider integration, but it is not required to complete Gate 4B QA.

Production `wfxnwfcdjainpojhbdri`, Gate 4C, `db push`, financial/fiscal writes, full-submit, paid overage and unrelated changes remain forbidden.

## Historical autonomous Turnstile authorization

The earlier Turnstile-first authorization remains as design history. It may be used when authenticated Cloudflare/provider access is already available, but its missing private prerequisites no longer block Gate 4B because the providerless fallback is now authorized.

## Current gate after production metadata repair - 2026-07-22

The production metadata-only repair and Gate 3 are complete. Gate 4A source audit/design is complete. Gate 4B is the active QA execution gate under the providerless fallback above. Gate 4C production requires a later independent authorization. Do not repeat prior gates or infer that `db push` is safe.

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
- Gate 4B: explicitly authorized and active under the providerless QA fallback.
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
