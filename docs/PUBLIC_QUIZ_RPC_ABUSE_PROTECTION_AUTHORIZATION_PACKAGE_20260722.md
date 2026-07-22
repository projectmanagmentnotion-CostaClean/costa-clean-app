# Public Quiz RPC Abuse Protection Authorization Package — 2026-07-22

## Status

Gate 4A audit/design: **DONE, source-only**. Gate 4B QA implementation: **BLOCKED pending explicit authorization and external prerequisites**. Gate 4C production release: **BLOCKED pending QA PASS and a separate production authorization**.

This package authorizes nothing by itself. QA and production were not modified.

## Selected QA design

Cloudflare Turnstile Managed is validated server-side by a Supabase Edge Function. The Edge Function enforces body/contract/error limits, derives a short-lived HMAC guard from trusted request context and calls one private `service_role`-only transactional RPC. PostgreSQL repeats validation, rate-limits atomically, computes the canonical result, inserts one attempt and returns only the compact result. Anonymous history remains denied.

Upstash is not part of Gate 4B. It requires a future evidence-based authorization if distributed traffic exceeds the database-backed design.

## Exact authorized surface for a future Gate 4B

- Frontend: `src/features/publicQuiz/ManualQuizExperience.tsx`, `manualQuizApi.ts`, `types.ts`, one new Turnstile helper/component and colocated tests.
- Edge: `supabase/functions/submit-public-gym-manual-quiz/index.ts` and one `_shared` versioned quiz contract.
- SQL: exactly one new uniquely 14-digit-versioned migration, reviewed by filename and SHA-256 before apply.
- Database: one technical guard table, one private guarded submission RPC, grants/revokes limited to the quiz signatures/table, and no changes to existing attempt rows.
- Provider: one Cloudflare Turnstile QA widget; no Upstash or other provider.
- Secrets: QA Turnstile secret and HMAC pepper in Edge secret storage; service role remains Edge-only; public sitekey may be provided to the QA frontend. Values must never be printed/versioned.
- QA: only `kpvvydthlxupjjqqdpxy`, with explicit triple target identity and synthetic names/data.

## Required preflight

1. User approves Cloudflare as processor/subprocessor and confirms account owner, DPA/privacy review, QA hostname and free-plan/billing policy.
2. Secrets are supplied through an approved private mechanism and can be installed without exposing them.
3. Worktree starts clean at the authorized HEAD; exact migration/function/frontend diff is reviewed.
4. Disposable PostgreSQL proof passes; exact migration SHA-256, schema fingerprint, relevant function/grant/policy fingerprints and row counts are saved privately.
5. QA ref is exactly `kpvvydthlxupjjqqdpxy`; production `wfxnwfcdjainpojhbdri` and every other ref are rejected.
6. `db push` remains locked; apply uses an explicitly reviewed safe method, one transaction for SQL and a separately controlled QA Edge release.

## QA acceptance tests

- Valid Turnstile + exact 20 answers creates exactly one synthetic attempt and returns a generic compact result.
- Missing, malformed, expired, replayed or wrong hostname/action token creates zero rows.
- Unknown/missing fields, wrong types, body `>16 KiB`, excessive depth/cardinality/string length create zero rows.
- Client-forged score/result/error fields cannot control the stored/returned result.
- The fourth accepted request for one proposed HMAC bucket inside 15 minutes is denied `429`; threshold remains configurable only server-side.
- Direct anon/authenticated EXECUTE on old/private RPC is denied; direct table INSERT is denied.
- Anonymous attempt history remains `401/403`; authenticated history remains allowed.
- Provider timeout fails closed with generic `503`, bounded logs and no partial row.
- Logs contain no name, answers, raw IP, user-agent, token, secret or SQL/provider response body.
- Synthetic attempt/guard rows are uniquely tagged, removed, and exact preflight counts restored.
- Lint/build/tests pass; `db push` guards still fail intentionally.

## Rollback

Stop traffic first, revert QA frontend/Edge routing, then execute the reviewed inverse SQL in one guarded QA transaction. It may restore only the prior quiz RPC definition/grants, remove the new private quiz RPC and remove the guard table after dependency and synthetic-row checks. Anonymous history must remain closed. Remove QA-only secrets/widget if abandoned. Any divergence becomes an incident; never improvise production or business-data compensation.

## Costs and privacy

Estimated recurring incremental cost is `EUR 0/month` inside the current Turnstile and Supabase Edge free quotas; no paid overage is authorized. Cloudflare processes browser/device signals and the Edge layer transiently processes IP. Only a peppered HMAC is proposed for short storage. Clear IP, token, user-agent and payload logging are prohibited. Legal basis, notice, DPA/subprocessor/transfer review and attempt retention require owner confirmation.

## Abort criteria

Abort without QA mutation if any preflight/identity/hash/backup proof fails; provider or DPA is unapproved; secrets are unavailable/exposed; any anonymous history/read is reopened; private RPC grants are broader than `service_role`; payload/rate limits are missing; cleanup cannot restore baseline; production appears in target/config; costs may leave the approved free ceiling; or unrelated Auth, tenancy, financial, invoice, payment, closing, sequence, schema or data changes appear.

## Exact authorization needed for Gate 4B

The user must provide an instruction materially equivalent to:

> I explicitly authorize Gate 4B exclusively in Supabase QA `kpvvydthlxupjjqqdpxy`. Implement the reviewed Cloudflare Turnstile Managed + Supabase Edge Function + private transactional quiz RPC design described in the 2026-07-22 audit, implementation plan and authorization package. Authorization is limited to the listed public-quiz frontend/tests, one Edge Function and shared quiz contract, and exactly one newly reviewed 14-digit migration creating the technical HMAC rate-limit guard and private `service_role`-only quiz RPC while revoking anonymous/authenticated direct quiz mutation. I approve Cloudflare as the QA anti-bot provider and will provide/confirm the QA hostname, public sitekey, Turnstile secret and HMAC pepper through approved secret storage; no secret may be printed or committed. Apply only after disposable proof, exact migration hash review, private QA backup/fingerprints and triple target verification. Use synthetic QA data, prove allow/deny/replay/burst/privacy/cleanup behavior, and restore baseline counts. I do not authorize production, `db push`, anonymous history, Upstash, paid overage, clear-IP storage, real personal data, unrelated schema/data/Auth/financial changes, invoices, payments, closings, sequences or full-submit. Stop before Gate 4C and request separate production authorization.

If provider/DPA/hostname/secrets are not supplied and approved, Gate 4B remains blocked rather than falling back silently to a weaker architecture.
