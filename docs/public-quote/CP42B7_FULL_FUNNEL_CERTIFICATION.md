# CP-4.2B.7 Full Funnel Certification

Status: `QA_CERTIFIED`
Date: `2026-09-16`

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

### Runtime certification

The owner executed the real local WEB runtime path in QA. The private,
Git-ignored report records `PASS` for the exact QA project
`kpvvydthlxupjjqqdpxy` and confirms the full `/api/quote` -> HMAC -> Edge ->
RPC path.

- The public response was minimal and did not expose restricted identifiers or
  estimate data.
- RES-C persisted the restricted expected values: 2 operators, 3 elapsed
  hours, 6 operator-hours, 120 EUR internal base and 60 EUR labor cost.
- The request persisted one lead, one intake, one quote draft seed, four
  consent records, one attribution record and the expected audit lifecycle.
- Consent separation, attribution gating, idempotent replay, B.6 intelligence
  classification and owner-approved `k=3` campaign suppression passed.
- Clients, properties, jobs, quotes, invoices and payments had zero delta.
- `cleanup_cp42b7_runtime_fixture_qa` removed only the exact synthetic
  fixture, restored baseline counts and preserved the append-only audit
  trigger.
- Production writes remained `0`.

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

`CP-4.2B` is `QA_CERTIFIED`. `CP-4.3` is `READY_TO_START` but is not
implemented by this certification closeout.
