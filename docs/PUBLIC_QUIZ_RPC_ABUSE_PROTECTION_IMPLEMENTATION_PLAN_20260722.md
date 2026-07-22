# Public Quiz RPC Abuse Protection Implementation Plan — 2026-07-22

## Recommended architecture

Use **Cloudflare Turnstile Managed + a Supabase Edge Function + a private transactional RPC**.

The browser sends only normalized name, quiz version, 20 answer choices, an empty honeypot, a request id and a Turnstile token to the Edge Function. The Edge Function enforces the raw-body limit, validates Turnstile server-side including hostname/action, derives a privacy-preserving HMAC guard key from the trusted request IP without storing the IP, and calls one private RPC. The RPC repeats the contract checks, applies atomic cooldown/deduplication, calculates the authoritative result, inserts one attempt and returns a compact result. Anonymous history remains denied.

Turnstile is authoritative for provider-token validity/replay; Edge/SQL validation and database rate buckets are authoritative for payload, scoring and local throttling. Honeypot, client timing and Origin checks are defense in depth only.

## Option comparison

Pricing was checked on 2026-07-22 against official provider documentation; actual account quotas and contracts must be rechecked before authorization.

| Option | Security / bot resistance | Cost and free-plan fit | Personal data | Complexity / maintenance | Decision |
| --- | --- | --- | --- | --- | --- |
| A. Hardened RPC only | Strong payload integrity and DB cooldown; weak against distributed bots and invocation floods | No new provider; DB/storage within existing plan until abuse consumes it | HMAC guard can avoid clear IP storage | Lowest, but database remains first public boundary | Rejected as sole protection; retain its validation principles behind Edge |
| B. Edge Function + private RPC | Hides mutation RPC and gives body/error/request controls; distributed limiter still limited | Supabase Free currently includes 500,000 Edge invocations/month; 100 functions and 150s worker duration limits | Edge transiently processes request IP | Moderate; one runtime and SQL contract | Viable fallback if provider approval is withheld, but weaker against bots |
| C. Turnstile + Edge + private RPC | Best low-cost combination: bot signal, single-use token, server gateway, atomic DB controls | Turnstile Free lists unlimited challenges, 20 widgets and 10 hostnames/widget; Edge quota as above | Cloudflare processes browser signals; Edge may process IP transiently; no clear IP storage proposed | Moderate; Cloudflare account/DPA, two secrets and monitoring | **Recommended** |
| D. External rate limiting (Upstash) | Strong distributed counters when combined with Edge/Turnstile; does not prove humanity alone | Free currently: 500k commands/month, 256 MB, 10 GB bandwidth; PAYG $0.20/100k commands; fixed from $10/month | Another processor receives pseudonymous key and timing metadata | Highest; extra account, region/DPA, secret, failure mode and archival behavior | Defer until measured need; not justified for initial Costa Clean volume |

Official references:

- Supabase Edge pricing and limits: <https://supabase.com/docs/guides/functions/pricing> and <https://supabase.com/docs/guides/functions/limits>
- Cloudflare Turnstile plans and server validation: <https://developers.cloudflare.com/turnstile/plans/> and <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>
- Upstash Redis pricing: <https://upstash.com/pricing/redis>

Expected recurring cost for the recommended initial design is **EUR 0/month while usage remains inside the current free quotas**. This is an estimate, not a billing guarantee. The plan must abort rather than silently enable paid overage. Database storage/egress and existing Supabase project quotas still apply.

## Proposed repository changes for Gate 4B

No listed change is implemented by this document.

### Frontend

- Modify `src/features/publicQuiz/ManualQuizExperience.tsx`: managed Turnstile lifecycle, honeypot, retry-safe UX and generic errors.
- Modify `src/features/publicQuiz/manualQuizApi.ts`: call the Edge endpoint; send name/quiz version/answers/request id/token only; never use `service_role`.
- Modify `src/features/publicQuiz/types.ts`: separate public request and compact response types; stop accepting client-authored score/error records.
- Add `src/features/publicQuiz/turnstile.ts` or a small colocated component with no bundled secret.
- Add unit tests for payload construction, generic error mapping, expired token/retry and accessible failure states.

### Edge Function

- Add `supabase/functions/submit-public-gym-manual-quiz/index.ts`.
- Add `supabase/functions/_shared/gymManualQuizContract.ts` for versioned question IDs/options/answer key used server-side.
- Enforce POST/content type/`16 KiB`, exact schema, Turnstile Siteverify timeout, expected hostname/action, HMAC guard derivation and bounded logs.
- Use the Supabase server-side service credential only in the Edge secret store. It must never appear in frontend, logs, reports or Git.

### New uniquely versioned migration

Create one new 14-digit migration during the authorized implementation; its final filename and SHA-256 must be reviewed before QA apply. It would:

- create `public.public_quiz_submission_guards(fingerprint_hash text, bucket_start timestamptz, accepted_count integer, expires_at timestamptz, primary key (fingerprint_hash, bucket_start))` with bounded checks and expiry index;
- enable RLS and grant no table access to `PUBLIC`, `anon` or `authenticated`;
- create/replace a private transactional RPC such as `public.submit_public_gym_manual_quiz_attempt_guarded(jsonb, text, uuid)` with fixed `search_path`, exact contract, atomic bucket increment/cap, idempotency guard, authoritative result calculation, bounded cleanup and compact response;
- revoke EXECUTE on the existing public RPC from `PUBLIC`, `anon` and `authenticated`, and grant only the private signature to `service_role`;
- preserve authenticated SELECT on attempt history and preserve anonymous SELECT denial;
- avoid changing existing attempt rows, financial tables, sequences, invoice identifiers or unrelated policies.

The implementation must decide whether to retain the old signature as a no-access compatibility stub or drop it only after source/catalog dependency checks. Direct table INSERT must remain unavailable to anon/authenticated.

## Secrets and configuration

- Public/non-secret: `VITE_TURNSTILE_SITE_KEY` scoped to QA hostnames first.
- Edge secret: `TURNSTILE_SECRET_KEY`.
- Edge secret: `PUBLIC_QUIZ_FINGERPRINT_PEPPER`, random and independently rotatable.
- Edge/server credential: platform-provided Supabase URL and service-role credential, Edge-only.
- Configuration: expected hostname/action, rate thresholds and fail-closed timeout.

No value is committed. Cloudflare account ownership, DPA/subprocessor review, QA hostname and secret delivery are external prerequisites.

## QA-first execution phases

1. Approve provider/privacy/hostname, create QA widget outside Git and store secrets through approved secret management.
2. Implement tests and Edge/SQL/frontend changes locally; validate migration in disposable PostgreSQL without `db push`.
3. Capture exact migration filename/hash, schema/count fingerprints and rollback; obtain/confirm QA-only mutation authorization.
4. Apply the one reviewed migration and Edge Function only to QA ref `kpvvydthlxupjjqqdpxy` using explicit target guards.
5. Run allow/deny matrix: valid submission, missing/invalid/expired/replayed token, wrong hostname/action, malformed/extra/oversized payload, canonical score, burst/cooldown, distributed hashes, direct RPC denial, anon history denial, authenticated history read and provider outage.
6. Prove created synthetic attempts/guard rows are tagged and removed; counts return to baseline. Never submit real names.
7. Produce a QA gate report. Production stays blocked until an independent authorization package cites the exact QA evidence and artifacts.

## Rollback and cleanup

QA rollback is a reviewed inverse migration plus Edge/frontend rollback: restore the previous RPC definition/grants only in QA, remove the new private RPC and guard table after proving no unexpected dependencies, revert the Edge route/frontend endpoint, delete QA secrets/widget if no longer needed, and delete only tagged synthetic QA attempts. Rollback must not reopen anonymous history. Production rollback must be designed separately from a fresh private backup and exact live catalog evidence.

Operational cleanup deletes expired guard buckets in bounded batches; a scheduled mechanism is optional and must be explicitly authorized. Attempt-record retention cannot be guessed: define purpose/legal retention with the business owner before any deletion job.

## GDPR / EU impact

`nombre_trabajador` is identifiable personal data. A trusted request IP is personal data when processed by Edge/Cloudflare even if not stored. The proposed design minimizes storage to an HMAC pseudonym with a secret pepper and short retention, omits raw IP/user-agent/token/payload from logs, and uses aggregate telemetry. Pseudonymization is not anonymization.

Before Gate 4B: document controller purpose/lawful basis, retention, transparency notice, Cloudflare DPA/subprocessor and transfer posture, access/deletion handling and incident ownership. This is an engineering risk assessment, not legal advice.

## Stop conditions

Abort on unknown target, provider/DPA refusal, missing approved secrets/hostname, migration hash drift, direct anon/auth access remaining, anonymous history reopening, non-generic errors, clear IP/token/payload logging, failed cleanup proof, free-quota/billing uncertainty, or any unrelated schema/business/financial change.
