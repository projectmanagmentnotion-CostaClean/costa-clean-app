# Gate 4B — Autonomous QA Setup and Execution Authorization

Date: 2026-07-22
Project: Costa Clean App
Authorized environment: Supabase QA `kpvvydthlxupjjqqdpxy`
Forbidden environment: Supabase production `wfxnwfcdjainpojhbdri`

## Authorization

The project owner explicitly authorizes Codex and the local continuation agent to take operational control of Gate 4B and complete the private prerequisites, implementation, QA deployment, verification, cleanup, documentation, commit and push, subject to the boundaries in this document.

This authorization includes using the app's existing hosting and domain infrastructure to provision a stable QA hostname. Codex must inspect the actual deployment and DNS configuration first and must not assume the provider or domain layout.

## Authorized work

Codex may:

1. Inspect repository deployment configuration, hosting documentation, environment configuration and existing QA/staging URLs.
2. Select an existing stable QA hostname when one already exists.
3. If no stable QA hostname exists, create a dedicated QA subdomain or staging hostname under the app's actual domain using the current hosting/DNS provider, provided existing authenticated access is available on this workstation.
4. Prefer `qa.<actual-app-domain>` or `staging.<actual-app-domain>` only after verifying that this does not alter the live production hostname or routing.
5. Create a Cloudflare Turnstile Managed widget restricted to the exact QA hostname, using an existing authenticated Cloudflare session or API credential available privately on this workstation.
6. Install the public Turnstile site key only in the QA frontend environment.
7. Install `TURNSTILE_SECRET_KEY`, `PUBLIC_QUIZ_FINGERPRINT_PEPPER` and the allowed QA hostname in Supabase QA Edge Function secrets.
8. Use the Supabase server-side credential that is automatically available to the Edge Function or another server-side-only QA credential. It must never be exposed to the frontend.
9. Generate an independent cryptographically secure HMAC pepper locally and store it only through private secret mechanisms.
10. Implement the authorized frontend, shared contract, tests, one Edge Function, one private transactional RPC and one unique 14-digit incremental migration.
11. Run the disposable PostgreSQL proof before remote application.
12. Apply the reviewed migration exclusively to Supabase QA using PostgreSQL 17, `ON_ERROR_STOP` and one transaction; `db push` remains prohibited.
13. Deploy the Edge Function exclusively to Supabase QA.
14. Deploy or configure the quiz frontend exclusively on the QA hostname.
15. Execute synthetic QA tests, inspect logs for privacy violations, clean all synthetic residues, update documentation, commit and push.
16. Reactivate the continuation agent after Gate 4B and stop before Gate 4C.

## Provider and hosting decision rules

Codex must inspect the real state and choose the least disruptive option:

1. Reuse an existing stable QA/staging deployment if available.
2. Otherwise create a dedicated QA deployment on the current hosting provider.
3. Otherwise create a QA subdomain on the current domain and route it to the existing deployment platform.
4. Do not repoint, replace or modify the production hostname.
5. Do not move the live domain to Cloudflare merely to use Turnstile. Turnstile may be used independently of the DNS provider.
6. Do not enable a paid plan, paid overage or a provider that requires new recurring cost.

## Private prerequisites and credential handling

Codex is authorized to use credentials already available through authenticated local sessions, provider CLIs, password managers exposed to the workstation, environment variables or private ignored files.

Codex must not:

- print secret values;
- copy secrets into chat, Git, Markdown, logs or screenshots;
- store secrets in versionable `.env` files;
- expose a server-side Supabase credential in browser code;
- store raw IP addresses, Turnstile tokens, full payloads or user agents;
- commit `.project-agent/private/`, private reports, auth state, cookies or provider exports.

If a provider requires interactive login, MFA, CAPTCHA, email confirmation, billing acceptance or another human-only action, Codex must stop only at that exact step and provide a minimal action request. After the user completes it, the continuation agent must resume from the same gate rather than repeat prior work.

## Mandatory architecture

The public path must be:

`QA frontend → Turnstile Managed → Supabase Edge Function → server-side Turnstile verification → strict shared-contract validation → HMAC throttling → private transactional RPC → minimal insert`

Mandatory controls:

- strict body-size limit;
- strict field allowlist;
- rejection of unknown fields;
- field length and value bounds;
- result recalculated server-side;
- fixed `search_path`;
- private RPC not executable by `anon` or directly by browser clients;
- no public history reads;
- generic public errors;
- fail-closed configuration;
- replay and cooldown controls;
- short retention for pseudonymous HMAC throttling data;
- no raw IP persistence;
- no token, payload or user-agent logging.

## Authorized QA writes

Authorized only in QA `kpvvydthlxupjjqqdpxy`:

- one reviewed incremental migration;
- quiz-specific schema/RPC/grant changes defined by the approved Gate 4A package;
- Edge Function deployment and secrets;
- synthetic quiz submissions necessary for tests;
- cleanup of all synthetic test rows.

## Explicitly forbidden

This authorization does not allow:

- any change in production `wfxnwfcdjainpojhbdri`;
- Gate 4C;
- `db push`;
- migration-history repair;
- Upstash or paid external rate limiting;
- paid Cloudflare/Supabase overage;
- changes to invoices, invoice lines, payments, expenses, quarterly or annual closings;
- changes to `invoice_number`, fiscal `display_code` or fiscal sequences;
- full-submit;
- real customer data;
- unrelated refactors;
- multitenancy implementation;
- reopening anonymous reads.

## Required gates before QA apply

Before any remote write, Codex must prove:

1. destination ref equals `kpvvydthlxupjjqqdpxy`;
2. destination ref is not `wfxnwfcdjainpojhbdri`;
3. production connection details are not being used;
4. backup/fingerprints and affected-object inventory are captured privately;
5. the migration has a unique 14-digit version and SHA-256;
6. disposable PostgreSQL proof passes;
7. rollback is reviewed;
8. secrets are installed privately;
9. the QA hostname and Turnstile hostname restriction match exactly.

## Required QA verification

Gate 4B is complete only after proving:

- legitimate submission succeeds;
- missing, invalid and reused Turnstile tokens fail;
- oversized, malformed, unknown-field and out-of-range payloads fail;
- cooldown and replay protection work;
- direct anonymous RPC execution fails;
- anonymous history read fails;
- configuration failure fails closed;
- public responses reveal no internals;
- logs contain no raw IP, token, full payload, name or user-agent;
- all synthetic QA records are removed;
- production was not touched;
- financial/fiscal writes are zero;
- lint, build and all tests pass;
- both repository `db push` locks still fail intentionally.

## Commit and continuation

After a passing Gate 4B:

- commit message: `security: protect public quiz submission in QA`;
- push to `origin/main`;
- update the closeout roadmap, checklist, risk map, quality gates and release log;
- reactivate the continuation agent;
- stop before Gate 4C and request a separate production authorization package.

## Stop conditions

Codex must stop without simulating success when:

- no authenticated access exists for the required hosting, DNS, Cloudflare or Supabase operation;
- a human-only MFA or account-confirmation step is required;
- a paid plan or billing acceptance is required;
- the QA hostname cannot be isolated from production;
- the destination identity cannot be proved;
- the migration or rollback proof fails;
- tests leave residues or expose sensitive logs;
- any operation would exceed this authorization.
