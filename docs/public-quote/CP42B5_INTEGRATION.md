# CP-4.2B.5 Public Quote CRM Integration

Status: `IMPLEMENTED_AWAITING_QA_RUNTIME_CERTIFICATION`

## Scope

The canonical public quote transport is versioned as `cp42b-v2`. The browser
posts only to the web `/api/quote` boundary. The web server signs the payload
and calls the QA-only `public-lead-intake` Edge Function. The Edge Function
validates the HMAC, derives `estimate_v1` with the canonical
`costa_clean_quote_intelligence@1.0.0` evaluator, and calls the atomic
`submit_public_quote_request_qa` RPC.

The RPC creates one restricted intake correlation row, one CRM lead and one
internal `quote_draft_seed_v1`. It never creates or links a client, property,
job, quote, invoice or payment.

## Wire Contract

The historical v1 validator accepted `marketing_cookie_consent` and rejected
the current B.4 `advertising_cookie_consent` field. It also only mapped legacy
Spanish service slugs. The current B.4 payload was therefore classified
`INCOMPATIBLE` with the historical v1 shape. v2 uses the canonical service
families and these independent consent fields:

- `privacy_acknowledged`
- `marketing_contact_opt_in`
- `analytics_consent`
- `advertising_cookie_consent`

`marketing_cookie_consent` is rejected in v2 and is retained only by the v1
compatibility validator. No field is silently dropped.

## Storage Mapping

| Concept | QA storage | Boundary |
| --- | --- | --- |
| Intake correlation | `public_lead_intake_requests` | service role only |
| Structured operational request | ledger `operational_request`, seed `operational_summary` | internal review |
| Contact PII | existing `public.leads` fields | internal CRM only |
| Consent ledger | `public_quote_intake_consents` | service role and active internal staff read |
| Attribution | `public_quote_intake_attribution` | service role and active internal staff read |
| Quote draft seed | `public_quote_draft_seeds` | service role and active internal staff read |
| Audit | `public_quote_intake_audit` | service role and active internal staff read |

PII is not copied into the seed, intelligence, attribution summary or
analytics. Free text remains `review_context` and lead reviewer context. Click
IDs are stored only when advertising-cookie consent is true; UTMs are kept in
the restricted attribution record and never placed in intelligence.

## Estimate and Review Boundary

Only standard residential apartments can receive Tier A internal support:

- RES-A: 1 operator, 3 elapsed hours, 3 operator-hours, 60 EUR base, 30 EUR labor
- RES-B: 1 operator, 4 elapsed hours, 4 operator-hours, 80 EUR base, 40 EUR labor
- RES-C: 2 operators, 3 elapsed hours, 6 operator-hours, 120 EUR base, 60 EUR labor

Every seed starts with `commercial_draft.status = needs_review`,
`reviewer_required = true`, and null customer price, VAT and commercial total.
Non-Tier-A services remain manual with null numeric workload.

## Security and Rollback

All new tables enable and force RLS. Anonymous and generic authenticated roles
have no data access; only active internal staff have read policies. Writes are
available to the service role used by the QA Edge Function. The RPC does not
perform identity matching and uses `submission_id` as the sole correlation
key. Idempotent replays return the existing safe receipt; a different payload
hash returns a conflict. Audit rows are append-only from the public path.

Rollback is non-destructive: disable the v2 Edge route first, then remove only
rows explicitly marked `contract_version = 'cp42b-v2'` after review. Do not
delete CRM leads by email or phone and do not alter the existing v1 ledger or
conversion RPCs.

## QA Runtime Evidence - 2026-09-15

Owner authorization was limited explicitly to Supabase QA
`kpvvydthlxupjjqqdpxy`; production remained prohibited and received zero
writes.

Applied QA migrations:

- `20260915184220_cp42b5_public_quote_lead_seed_qa`
- `20260915184611_cp42b5_receipt_case_compat_qa`

The second migration is a runtime-discovered compatibility fix. The existing
ledger check accepted only uppercase hexadecimal UUID characters while
PostgreSQL emits UUID text in lowercase. The fix preserves the `QA-CP42B-`
prefix and accepts canonical UUID hexadecimal case. No production schema was
changed.

`public-lead-intake` was deployed to QA as active version 8 with
`verify_jwt=false`; HMAC authentication remains mandatory in the function body.
The four restricted tables have both RLS and FORCE RLS enabled. Anonymous users
have no seed/consent read grant, generic authenticated access is filtered by the
internal-staff policy, and only `service_role` can execute
`submit_public_quote_request_qa`.

A synthetic direct-RPC runtime fixture for RES-B produced exactly one lead, one
intake row and one `quote_draft_seed_v1`. The persisted estimate was 1 operator,
4 elapsed hours, 4 operator-hours, 80 EUR internal base and 40 EUR internal
labor. `customer_price`, VAT and commercial total remained null and human review
remained required. Independent consent rows were correct; advertising consent
false stored no click IDs. Replaying the same submission/hash returned
`idempotent` without duplicates; changing the payload hash returned
`idempotency_conflict`.

During the fixture, clients, properties, jobs, quotes, invoices and payments had
zero delta. The synthetic lead/intake/seed/consent/attribution/audit fixture was
then removed safely and all entity counts returned to their pre-test baseline.

The full web -> HMAC Edge -> RPC runtime path is still `NOT_EXECUTED` because the
current execution context does not have the server-side HMAC signing secret and
SiteGround private environment configuration remains a separate deployment
debt. This is not counted as PASS.

Therefore CP-4.2B.5 remains
`IMPLEMENTED_AWAITING_QA_RUNTIME_CERTIFICATION` until one signed synthetic
request traverses the complete web/Edge path successfully. Database persistence,
RLS, RPC idempotency/conflict behavior and the deployed QA Edge artifact are
runtime-verified.
