# Public Quiz RPC Abuse Protection Audit — 2026-07-22

## Gate and evidence boundary

Gate 4A is a source-only audit. QA and production were not queried or modified. No RPC, migration, policy, grant, Edge Function, provider account or application file was changed. Live catalog state is represented only by the dated closure reports already in the repository.

## Current submission contract

| Area | Source evidence | Current behavior |
| --- | --- | --- |
| Public routes | `src/app/publicStandaloneRoutes.ts:2`, `src/App.tsx:166` | Three unauthenticated aliases render the quiz page. |
| UI | `src/features/publicQuiz/ManualQuizExperience.tsx:21-69` | Normalizes a worker name, requires all 20 answers and computes the result in the browser. |
| Client transport | `src/features/publicQuiz/manualQuizApi.ts:12-30` | Calls `/rest/v1/rpc/submit_public_gym_manual_quiz_attempt` with the public anon key and exposes the raw REST error body to the visitor. |
| Payload | `src/features/publicQuiz/types.ts:3-18` | Name, client-computed score/percentage/pass flag, full answer map, full error review and total question count. No nonce, start time, honeypot or verification token. |
| RPC | `supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:95-149` | `SECURITY DEFINER`, fixed `search_path`, object/field allowlist, name length and score-consistency checks, then one insert and full-row JSON response. |
| Grants | Same migration, lines `155-156` | EXECUTE is granted to `anon` and `authenticated`, not `PUBLIC`. |
| Storage | `supabase/migrations/20260721_qa_baseline_schema.sql:2458-2472` | Stores name, result, answers, detailed errors and timestamps. Constraints cover name and numeric ranges, not JSON size/cardinality. |
| History privacy | Closure migration, lines `163-217` | Anonymous SELECT/policies are removed; authenticated history remains workspace-wide. |
| Tests | `src/app/publicStandaloneRoutes.test.ts:23-25` | Route aliases are tested. No unit/integration abuse, payload-boundary, replay or rate-limit tests exist. |

No source contract exposes a trustworthy IP, user-agent or session key to PostgreSQL. Those request properties are available only at a gateway/Edge boundary and can be spoofed unless taken from the platform's trusted request context. No duplicate/spam control or retention job exists.

## Existing protections and material gaps

Existing protections are useful but insufficient: strict top-level allowlist, fixed `search_path`, name length, numeric consistency, JSON type checks, server timestamp, no anonymous history and minimum EXECUTE grants for the current architecture.

Material gaps:

- Result correctness is not server-authoritative. A caller can submit any internally consistent total/score/answer/error combination; the RPC does not validate the canonical 20 questions or answer choices.
- `respuestas_json`, `errores_json` and the HTTP body have no byte, depth, cardinality or string limits.
- There is no burst limit, cooldown, replay/idempotency key, nonce, honeypot, minimum completion time, deduplication or retention.
- Direct REST bypass is intentional and unlimited; frontend checks are not a security boundary.
- The function returns the complete stored row, including detailed answer/error JSON.
- Raw database/PostgREST error text is rendered by the frontend, potentially exposing internal detail and amplifying logs.
- `nombre_trabajador` is personal data; full error text also duplicates public question content and unnecessarily increases storage.

## Threat and control matrix

| Threat | Prevention | Detection | Recovery | Residual risk | QA assertion |
| --- | --- | --- | --- | --- | --- |
| Automated spam / unlimited rows | Turnstile validated server-side, per-HMAC time bucket and hard cooldown before insert | Counts of allowed/limited/Turnstile-denied outcomes only | Disable Edge route or lower cap; purge expired guard rows | Human farms and distributed valid tokens | Burst crosses threshold: generic `429`, attempt count stops growing |
| Replay | Turnstile single-use token plus request id/idempotency record | Duplicate-token/request counters | Expire idempotency records | Legitimate retry needs a new token unless prior result is safely replayed | Same token/request cannot create two attempts |
| Oversized/deep JSON | Edge request-size limit before parse; exact keys; 20 answer keys; short scalar limits; RPC repeats hard constraints | Size-rejection counter without payload bodies | Reject `413/400`; no row | Platform receives some bytes before rejection | Boundary accepted; +1 byte/depth/cardinality rejected with zero rows |
| Unexpected fields / bypass | Exact Edge and RPC allowlists; revoke anon/authenticated EXECUTE from insert RPC | Invalid-contract counter | Fail closed | Drift between Edge and SQL contracts | Unknown key rejected both at Edge and direct RPC |
| Forged result/enumeration | Client sends answers only; Edge/RPC recalculates score/result from versioned quiz contract | Result-mismatch/drift test | Reject unsupported quiz version | Answer key is already visible in public JS; secrecy is not promised | Forged score fields ignored/rejected; canonical result returned |
| Distributed abuse | Turnstile plus HMAC rate bucket; optional external limiter only if observed load exceeds DB design | Aggregate denial rate and Edge invocation budget alerts | Tighten thresholds or authorize external limiter | Large distributed human/bot traffic can consume free quota | Multiple guard hashes are allowed only within global safety ceiling |
| Frontend bypass / origin spoofing | Edge is sole public write ingress; private RPC; Turnstile hostname/action check | Direct RPC denial probes | Revoke route/function if drift occurs | Origin headers alone are forgeable | Anon/auth direct RPC EXECUTE denied; Edge valid flow succeeds |
| Internal error exposure / log amplification | Stable generic 400/403/429/503 responses; structured bounded event codes; never log payload/name/token/IP | Error-code rates and bounded request id | Disable noisy logging and rotate secrets if exposed | Provider/platform logs remain processors | Responses contain no SQL/function/provider detail; logs contain no body |
| Unnecessary PII / retention growth | Store normalized name and compact result; short guard retention; define attempt retention separately before deletion | Row-age/count reports, no row bodies | Authorized cleanup job and documented backup policy | Business may require historical training evidence | Expired guard rows are deleted; clear IP/token never stored |
| Service exhaustion | Body limit at gateway, short provider timeout, bounded DB statements/indexes and fail-closed circuit | Latency/error/quota alerts | Temporarily close submission with user-safe message | Edge/provider outage blocks legitimate submission | Timeout produces generic `503`, zero partial writes |

## Level assessment

### Level 1 — mandatory in every implementation

- Server-authoritative exact contract and quiz version.
- Maximum raw request size `16 KiB`; JSON object depth at most `3`; exactly 20 answer entries; question/option identifiers each at most `16` characters; normalized name `2..120` characters; verification token at most `2048` characters.
- Reject extra/missing keys and non-string answer values.
- Recalculate score, percentage, pass flag and compact error list server-side.
- Fixed `search_path`, private mutation RPC, minimum grants and no anonymous history.
- Generic stable errors; no payload/name/token/IP in logs.

### Level 2 — preferred without another data provider

- Empty honeypot and a signed/server-verifiable form start token or Turnstile issuance time; browser-only timestamps are supplemental.
- HMAC-SHA-256 of normalized trusted client IP using a rotating secret pepper; never store clear IP or raw user-agent.
- One short bucket per HMAC with an initial proposal of `3` accepted submissions per `15 minutes`, plus a bounded global ceiling and explicit `Retry-After`.
- Single-use provider token and request id for replay-safe behavior.
- Guard rows retained no more than `24 hours`; aggregate counters may be retained `30 days` without names, IPs or payloads. Attempt-record retention requires a separate business/legal decision and is not silently imposed here.

### Level 3 — infrastructure

Use a Supabase Edge Function as the only public write gateway and Cloudflare Turnstile Managed mode. Keep an external Redis limiter optional until measured traffic or database pressure justifies the additional processor and secret.

## Source-only verdict

The current RPC is not sufficient against automated abuse. Gate 4A design is complete, but Gate 4B implementation remains blocked pending explicit QA authorization, provider/DPA decision, secrets provision through approved stores and a newly reviewed migration. Anonymous history must remain closed throughout.
