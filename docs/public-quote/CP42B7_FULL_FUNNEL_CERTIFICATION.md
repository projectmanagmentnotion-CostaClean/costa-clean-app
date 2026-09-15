# CP-4.2B.7 Full Funnel Certification

Status: `PARTIAL_QA_CERTIFICATION`
Date: `2026-09-15`

## Scope

This gate certifies the available local contract and QA read evidence for the
public quote funnel. It does not change production, DNS, SiteGround, ads,
CRM navigation or external providers.

The intended path is:

`/presupuesto` -> `/api/quote` -> server-side HMAC -> QA Edge
`public-lead-intake` -> `submit_public_quote_request_qa` -> lead/intake/seed,
consent, attribution and audit -> internal demand intelligence.

## Owner-approved threshold

`AGGREGATION_THRESHOLD = 3`

`OWNER_APPROVED_2026_09_15`

This threshold applies to campaign, UTM-source, UTM-campaign and attribution
classification output. It is not a guarantee of anonymization. Small groups
remain suppressed in marketing/campaign BI; operational service and city
reporting are separate internal operational views.

## Evidence

### Verified

- QA target is `kpvvydthlxupjjqqdpxy`.
- Production writes are `0`.
- QA intake tables have RLS and FORCE RLS enabled.
- `submit_public_quote_request_qa` execute permission is service-role-only;
  anon and authenticated execution are denied.
- Current QA Edge function `public-lead-intake` is active at version `9`.
- Existing B.5 runtime evidence covers the QA RPC/database path, RES-B,
  idempotent replay, conflict, cleanup and zero delta for canonical entities.
- B.6 local tests cover normalization, all eight service families, attribution,
  consent independence, privacy projection, deduplication and threshold
  suppression.
- B.7 local tests cover the owner-approved threshold and the Tier-A/manual
  aggregate branches.

### Not certified in this run

The real local WEB runtime request could not be executed because no safe
`PUBLIC_LEAD_INTAKE_SECRET` is available in the WEB runtime configuration.
Only `.env.example` exists and it contains no secret. The signer was not
regenerated or changed, and no secret was read from, printed, or written to
tracked files.

Therefore the following remain `NOT_EXECUTED` rather than PASS:

- `/api/quote` -> real HMAC -> QA Edge -> RPC runtime chain;
- brand-new B.7 synthetic runtime fixture and database verification;
- real WEB idempotent replay;
- runtime cleanup and baseline restoration for that B.7 fixture;
- runtime BI loading while the synthetic fixture exists.

The exact blocker is `HMAC_SIGNER_SECRET_UNAVAILABLE` for the local WEB
runtime. This gate must not be marked `QA_CERTIFIED` until that path is run.

## Synthetic matrix prepared

The local contract test matrix covers RES-A, RES-B, RES-C, residential above
100 m2, tourist, hotel, office/commercial, gym, post-work/tenant-change and
other/manual branches. Contact, consent, attribution and privacy behavior are
covered by the existing WEB and APP contract suites. No real customer identity
is used by the B.7 tests.

## Privacy and outcome boundary

Demand intelligence contains no name, phone, email, free text, exact address,
postal code, client/property identifiers, raw click IDs or internal price
fields. Lead outcome mapping uses only the existing explicit `new`, `contacted`,
`quoted`, `won` and `lost` statuses; conversion is never inferred from PII.

No client, property, job, quote, invoice or payment is created by the public
intake path. Final quote creation remains an explicit human-reviewed action.

## External debt

`SITEGROUND = BLOCKED_EXTERNAL_INFRASTRUCTURE` and
`SITEGROUND_QA_SIGNER_SYNC_REQUIRED` remain separate deployment debt. No
SiteGround change was attempted in this gate.

## Next gate action

Provide the already-approved QA signer to the local WEB runtime through a
private, ignored environment mechanism, without committing or displaying it.
Then run the real B.7 synthetic path and record the exact counts, receipt,
cleanup and restored baseline before changing this status.
