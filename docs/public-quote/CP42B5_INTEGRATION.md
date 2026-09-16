# CP-4.2B.5 Public Quote CRM Integration

Status: `QA_CERTIFIED`

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

Local contract/evaluator tests cover v2/v1 compatibility, advertising gating,
all eight service families, RES-A/B/C values, complex residential manual
review and no customer-price output.

Runtime certification was executed on 2026-09-15 against QA project
`kpvvydthlxupjjqqdpxy` only. The server-only QA signer was rotated and
configured without recording its value or digest. The local web boundary used
was `http://127.0.0.1:3010/api/quote`; the secret was not placed in tracked
files or exposed through a `NEXT_PUBLIC_*` variable.

The synthetic submission was correlated by submission ID
`ab5c57bc-4476-4f86-8751-59a70475ef30` and traversed the real path:
local web `/api/quote` -> HMAC -> `public-lead-intake` Edge Function v8
(`ACTIVE`, `verify_jwt=false` by design) -> `submit_public_quote_request_qa`.
Two identical requests returned HTTP 200 with the safe public response
`{"ok":true}`. No lead, seed or internal estimate identifiers were returned.

The applied QA migrations were:

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

The successful local web runtime fixture for RES-B produced exactly one lead, one
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

During the fixture there was exactly one intake, one lead, one seed, four
consent records, one attribution record and five audit events, including
`idempotent_replay`. The intake was `cp42b-v2` and `pending_review`; the seed
was `quote_draft_seed_v1` using `estimate_v1`. RES-B persisted as 1 operator,
4 elapsed hours, 4 operator-hours, 80 EUR internal base and 40 EUR labor.
`commercial_draft.status` was `needs_review`, `reviewer_required` was true,
and customer price, VAT and commercial total were null. Marketing and
analytics consent were false; advertising consent was false, so click IDs
were absent while the consent-permitted UTM source was retained. PII was
absent from intelligence, pricing support, estimate and attribution summary.

The replay was idempotent: no duplicate lead or seed was created. Clients,
properties, jobs, quotes, invoices and payments all had zero delta. The
synthetic records were deleted by exact submission ID and generated lead ID;
all QA counts were restored to baseline. RLS and FORCE RLS remained enabled,
anonymous and generic authenticated reads were denied, and the RPC remained
service-role-only.

The web contract fix in commit `5afa78f` gates only raw click identifiers when
advertising consent is false and preserves UTM attribution. Web quality
checks passed: unit tests 28/28, E2E 65 passed and 3 skipped, lint,
typecheck and build. App targeted CP42B5 tests were previously 14/14, with
app lint and build passing.

`SITEGROUND_QA_PREVIEW_DEPLOYMENT` remains
`BLOCKED_EXTERNAL_INFRASTRUCTURE`, separately from this local runtime gate.
Because the QA signer was rotated, `SITEGROUND_QA_SIGNER_SYNC_REQUIRED` is
recorded for a future authorized SiteGround QA preview attempt. No
SiteGround, production, DNS or email changes were made.

## CP-4.2B.7 certification state

The full funnel certification is `QA_CERTIFIED`. The owner executed the real
local WEB -> HMAC -> QA Edge -> RPC path, with exact synthetic cleanup and
baseline restoration. The private runtime report remains Git-ignored; no
secret, service-role key or synthetic contact identity was committed.
