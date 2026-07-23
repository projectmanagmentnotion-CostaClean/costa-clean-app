# Gate 4B — Providerless Public Quiz Abuse Protection in QA

Date: 2026-07-22  
Authorized QA: `kpvvydthlxupjjqqdpxy`  
Forbidden production: `wfxnwfcdjainpojhbdri`  
Result: **PASS**

## Scope and target control

Gate 4B implemented the authorized provider-independent path:

`public quiz frontend -> strict contract + honeypot/minimum interaction -> public QA Edge Function -> server validation -> HMAC pseudonymous throttling -> private transactional RPC -> minimal insert`

Before every mutation path, the runner required all of the following to resolve exactly to QA:

1. `.env.qa.local` public URL and `QA_SANDBOX_PROJECT_REF`;
2. the linked Supabase ref plus the authenticated CLI project list;
3. the private pooler username and a live PostgreSQL session.

The live session was PostgreSQL 17 on database `postgres`. The runner rejects production in public, linked and private identities. No production connection or deployment command was used.

## Reviewed migration and disposable proof

- Migration: `supabase/migrations/20260722171428_public_quiz_providerless_abuse_protection.sql`
- SHA-256: `8FE5E78E6BCFBCF15E3537CBDEBD8A3E852FBCA04209650E47FCFBF9DB3D9EF3`
- Unique 14-digit incremental files added by Gate 4B: `1`
- Transaction boundaries: exactly one explicit `BEGIN` / `COMMIT`
- Apply mechanism: PostgreSQL 17 `psql`, `ON_ERROR_STOP=1`, direct reviewed file
- `db push`: not used
- Migration repair/history write: not used

The disposable PostgreSQL proof passed authoritative scoring, legacy/private RPC grants, guard-table RLS, replay, cooldown, unknown-field rejection and cleanup. It finished with `attemptRows=0` and `guardRows=0`.

## QA before/after evidence

| Evidence | Before | After cleanup |
| --- | --- | --- |
| Public schema SHA-256 | `CA1876B2949D5766E868700387B602B077E1982990C624974B7DE43C49F09BA0` | `76FD84BBEC8DDA9B9B2D84BFCB82D2A1D089BBF29868D97EB1A5FE5F56E39334` |
| Guard table | absent | present, RLS enabled, `0` rows |
| Private submission RPC | absent | present; `service_role` only |
| Legacy public submission RPC | executable by anon/authenticated | denied to anon/authenticated |
| Anonymous quiz-history policy | `0` | `0` |
| Existing business row counts | baseline | unchanged |
| Gate 4B synthetic attempts | `0` | `0` |
| Migration-history versions | existing canonical set | unchanged |

The schema-only before/after exports, object metadata, row-count evidence, rollback SQL and synthetic report remain in ignored private paths. They contain no versioned secret.

## Edge Function and secret evidence

- Function: `submit-public-gym-manual-quiz`
- QA status: `ACTIVE`
- QA version: `1`
- Public ingress: `verify_jwt=false`
- Secret name present in QA: `PUBLIC_QUIZ_FINGERPRINT_PEPPER`
- Pepper generation: independent cryptographic random bytes
- Pepper handling: held in process memory, passed through a permission-restricted ignored temporary env file, then the temporary file was deleted
- Secret value read back or printed: no
- Production Edge deployment: no

The handler fails closed unless its Supabase URL resolves to the exact QA ref and the pepper is sufficiently long. It never logs request bodies, names, answers, nonce values, raw network identifiers, user agents, keys or secrets.

## Live synthetic matrix

| Case | Expected | Result |
| --- | ---: | ---: |
| Malformed JSON | `400` | PASS |
| Oversized body | `413` | PASS |
| Unknown field | `400` | PASS |
| Honeypot filled | `400` | PASS |
| Too-fast interaction | `400` | PASS |
| Legitimate exact request | `200` | PASS |
| Replay of accepted nonce | `429` | PASS |
| Cooldown with new nonce | `429` | PASS |
| Direct anonymous private RPC | `401/403/404` | PASS |
| Direct anonymous legacy RPC | `401/403/404` | PASS |
| Anonymous quiz-history read | `401/403` | PASS |
| Anonymous direct table insert | `401/403` | PASS |

The legitimate response was reconciled to exactly one stored synthetic attempt with server-authoritative `20/20`, `100%`, `passed=true`. Cleanup deleted only the exact synthetic attempt and the two known HMAC nonce guards. Independent post-cleanup verification found zero `QA-GATE4B-*` attempts and zero guard rows.

## Log privacy

The Management API queried only the Edge Function custom `function_logs.event_message` window for the Gate 4B run. Three matching accepted/replay/cooldown events were found after ingestion settled. Scans for the synthetic name, nonce, anon key, bearer/authorization text, user-agent text, forwarded-IP text, payload fields and IPv4 literals found `0` violations. Provider-managed network metadata was not copied into repository evidence.

## Protected domains and closeout

- Production modified: **NO**
- Invoices/payments/closings/fiscal numbering/sequences/full-submit: **0 operations**
- Real customer data: **NO**
- Cloudflare/Turnstile/DNS/Upstash/paid overage: **NO**
- Secrets versioned: **0**
- `db push` locks: remain active
- Initial HEAD: `d1b383739489abdcdcb4301229b9293b357cf266`
- Gate 4C: **BLOCKED pending a separate production authorization**

Final lint, build, complete tests, commit and push are reported in the delivery closeout.
