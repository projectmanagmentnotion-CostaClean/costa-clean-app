# CP-4.2B.6 Demand Intelligence and Attribution

Status: `IMPLEMENTED_AND_LOCAL_QA_CERTIFIED`
Contract: `public_quote_demand_intelligence_v1`

## Purpose

This is an internal, aggregate-only reporting layer over the already certified
public quote intake. It describes demand by service, coarse city, recurrence,
time and consent-permitted attribution. It does not create profiles, audiences,
budgets, campaigns, quotes or customer communications.

## Data Source and Architecture

The source is the existing authenticated internal read path:

- `public_quote_draft_seeds` supplies the restricted operational summary,
  review state, estimate availability and UTM summary.
- `leads` supplies the existing explicit lifecycle status for the linked lead.

`loadPublicQuoteDemandIntelligence()` joins those sources only in memory by the
existing seed `lead_id` relation. `buildPublicQuoteDemandIntelligence()` then
deduplicates by `submissionId`, normalizes allowlisted dimensions and emits a
new aggregate object. No new table, view, RPC, Edge Function, migration or
remote QA write is required for this local gate.

The existing internal-staff RLS policies remain the authorization boundary.
No portal or public route is wired to this report, and no permissions were
widened.

## Allowed Output

The report contains only aggregate counts and shares for:

- service family and service/city combinations;
- city, demand type, recurrence, frequency and coarse time windows;
- ISO week and month;
- tourist and hotel request counts, hotel checkout bands and residential size
  bands;
- explicit lead lifecycle outcomes;
- attribution classification, UTM source and campaign groups;
- campaign service mix, city mix, recurrence, review and Tier-A rates.

The eight canonical service families are preserved exactly:
`residential`, `deep_cleaning`, `tourist`, `office_commercial`, `gym`,
`hotel`, `post_work_tenant_change` and `other`.

Postal code is not used as a reporting dimension. Geography is limited to the
municipality/city value already present in the operational summary; no exact
address or fine-grained location is emitted.

## Forbidden Output

The report construction never copies full name, phone, email, exact address,
tax ID, client ID, property ID, free text, notes, raw review context, raw click
IDs, internal base price, labor cost, margin or customer price. The source may
contain restricted fields, but the aggregator explicitly projects only safe
dimensions rather than spreading source objects.

Raw `gclid`, `gbraid`, `wbraid` and `fbclid` are ignored by the BI projection.
They remain restricted to the consent-governed attribution record. Internal
estimate availability and rule ID are exposed only as non-price aggregate
dimensions; price and labor values are never returned.

## Normalization and Attribution

Dimension values are trimmed, whitespace-collapsed, lowercased and length
bounded. Unknown service values normalize to `other`; missing city, frequency
or time values use `unknown`. Duplicate submission IDs count once.

Attribution is deterministic:

- no UTM values and no referrer: `direct`;
- Google source (`google`, `googleads`, `google-ads`, `adwords`) plus a paid
  medium (`cpc`, `ppc`, `paid`, `paid_search`, `paid_social`, `social_paid`):
  `google_ads`;
- Meta source (`meta`, `facebook`, `instagram`) plus a paid medium: `meta_ads`;
- `utm_medium=organic`: `organic`;
- `utm_medium=referral` or an explicit referrer: `referral`;
- any remaining explicit but unsupported attribution: `unknown`.

UTM values are retained only as normalized aggregate copies. The restricted raw
attribution record is not rewritten.

## Metrics

`totals` provides request count, unique submission count, recurring share,
manual-review share and Tier-A share. Breakdown rows provide request count and
share. Recurrence is `recurring` for weekly, biweekly, monthly or explicit
recurring values; one-off and flexible values remain separate.

The existing lead status vocabulary is preserved: `new`, `contacted`, `quoted`,
`won` and `lost`. The report labels `won` as the explicit converted outcome;
it does not infer conversion from contact data. If no recognized status exists,
it is excluded from outcome denominators.

## Consent Boundary

Operational request aggregation is independent of optional consent choices.
Marketing-contact consent is not a score or quality feature. Analytics consent
controls analytics telemetry outside this report and does not erase the
operational request. Advertising consent controls raw click identifiers; it
does not change demand classification or estimate availability. Consent values
are not emitted in the aggregate report.

## Aggregation Threshold

`DEFAULT_AGGREGATION_THRESHOLD = 3`. Campaign, UTM-source, UTM-campaign and
attribution-classification rows with fewer than three unique submissions are
suppressed. This is the security default for marketing intelligence and is
`SECURITY_DEFAULT_PENDING_OWNER_REVIEW` until a stricter business-approved
threshold exists. Operational service, city and time reporting remains
available to authorized internal staff and is not a person-level export.

## CRM and Future Integrations

No CRM redesign or new navigation was added. The existing lead detail/review
surface remains the operational source of truth. B.6 does not create clients,
properties, jobs, quotes, invoices or payments and does not change the
lead-to-client conversion boundary.

Google Ads, Meta, audience uploads, pixels, conversion APIs, spend changes and
campaign activation are explicitly outside this gate. Any future integration
must consume only thresholded aggregate outputs and receive a separate owner
authorization.

## Verification

The local test suite covers UTM normalization, direct/organic/referral/Google/
Meta/unknown attribution, all eight service families, city and service-city
aggregation, week/month and time dimensions, recurrence, manual and Tier-A
shares, hotel/residential bands, explicit outcomes, deduplication, threshold
suppression, consent independence and the golden PII/click-ID/internal-price
exclusion test.

No Supabase remote object was changed, so `QA_REMOTE_CHANGE_REQUIRED = NO`,
`QA_WRITES = 0` and `PRODUCTION_WRITES = 0`. SiteGround remains
`BLOCKED_EXTERNAL_INFRASTRUCTURE`; its signer synchronization debt is
unrelated to this local intelligence layer.
