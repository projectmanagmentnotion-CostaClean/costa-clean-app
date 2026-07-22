# Anonymous Read Policy And Public Exposure Audit — 2026-07-22

> Actualización de cierre: el P0 fue corregido primero en QA y después, mediante autorización separada, en producción `wfxnwfcdjainpojhbdri` el 2026-07-22. En ambos destinos los diez probes anon pasaron de HTTP 200 a HTTP 401 y los probes authenticated permanecen HTTP 200. Evidencia: [P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md](P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md) y [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

## Verdict

- Severity: **P0**.
- Production project audited read-only: `wfxnwfcdjainpojhbdri`.
- QA project audited read-only: `kpvvydthlxupjjqqdpxy`.
- Production changes: none.
- QA changes: none.
- Migrations applied: none.
- Business rows created, updated, or deleted: 0.
- Invoices, payments, and closings operations: 0.

RLS is enabled on all 17 public tables in both environments, but RLS does not provide confidentiality when an anon-applicable policy uses `USING (true)`. Ten REST resources are readable with the public anon identity in both QA and production. They include personal, location, operational, commercial, payment, and fiscal data.

## Evidence and method

The audit used only read-only catalog queries and HTTP `HEAD` probes. Database inspection ran inside `BEGIN READ ONLY`; no policy, grant, function, schema, sequence, or row was changed.

For each environment the audit verified:

- the project ref derived from the private pooler identity;
- RLS state from `pg_class`;
- relation and column privileges effective for role `anon`;
- policies and their role applicability from `pg_policy`;
- effective function `EXECUTE` privileges;
- function security mode, fixed `search_path`, auth-guard signals, and referenced domains;
- anonymous REST reachability without returning or printing row bodies.

All ten exposed table endpoints returned HTTP `200` under anon in both environments. The catalog independently proves that their SELECT policies apply to anon and use unconditional `true` predicates.

## Effective anonymous table exposure

| Table / REST endpoint | Exposed columns of concern | Risk | Necessity | Recommendation |
| --- | --- | --- | --- | --- |
| `clients` | `full_name`, `phone`, `email`, `tax_id`, `billing_address`, status and lifecycle fields | P0 personal/fiscal | Internal only | Block anon; authenticated read only |
| `properties` | client linkage, name, full address, city, postal code, notes | P0 personal/location | Internal only | Block anon; authenticated read only |
| `leads` | name, phone, email, location, notes, conversion linkage and intake metadata | P0 personal | Public creation may be necessary; public listing is not | Preserve reviewed INSERT path only; block anon SELECT/UPDATE |
| `invoices` | `invoice_number`, fiscal/display codes, client/property links, totals, internal notes and pricing metadata | P0 financial/fiscal | Internal only | Block anon immediately in coordinated QA gate |
| `invoice_lines` | invoice linkage, concepts, quantities, prices and subtotals | P0 financial | Internal only | Block anon SELECT and legacy anon write policies |
| `payments` | invoice linkage, date, amount, method, origin and notes | P0 financial | Internal only | Block anon SELECT and legacy anon write policies |
| `quotes` | client/property/lead linkage, totals, internal notes and pricing metadata | P0 commercial/financial | Internal only | Block anon SELECT and legacy anon write policies |
| `quote_lines` | quote linkage, concepts, quantities, prices and subtotals | P0 commercial/financial | Internal only | Block anon SELECT and legacy anon write policies |
| `jobs` | client/property linkage, schedule, service details, billing fields and notes | P1 operational | Internal only | Block anon; authenticated read only |
| `public_gym_manual_quiz_attempts` | worker name, score, answers and errors | P0 employee personal data | Anonymous quiz submission may be expected; public history is not | Preserve reviewed INSERT only; block anon SELECT |

There is no P3 table exposure in the current catalog. The public-facing intake and quiz use cases justify narrowly validated submission endpoints, not unrestricted history reads.

## Granted but not currently row-readable

`annual_closings`, `audit_events`, `expenses`, `intake_submissions`, `lead_drafts`, and `quarterly_closings` have an effective anon SELECT grant but no anon-applicable SELECT policy. RLS therefore returns no rows today. QA also has this grant-only state on `job_lines`; production has no effective anon read on `job_lines`.

This is P2 defense-in-depth debt: the grants should be revoked in the correction gate so a future broad policy cannot silently expose the tables. A successful HTTP response with an empty result must not be treated as a confidentiality control.

## Anonymous RPC exposure

### Production

Twelve non-trigger functions have effective anon `EXECUTE` and are potential `/rest/v1/rpc/*` endpoints:

- `assert_invoice_numbering_regular`
- `backfill_invoice_fiscal_snapshots`
- `build_client_fiscal_snapshot`
- `build_invoice_display_code`
- `build_invoice_number`
- `ensure_invoice_pricing_metadata`
- `extract_invoice_display_sequence`
- `extract_invoice_fiscal_sequence`
- `find_first_missing_invoice_sequence`
- `invoice_status_consumes_fiscal_number`
- `save_invoice_with_lines_v2`
- `simplify_billing_concept`

`build_client_fiscal_snapshot` can return client name, tax ID, billing address, and email for a supplied client ID while anon client reads remain open. `ensure_invoice_pricing_metadata` can incorporate the same snapshot. These are P0 read paths.

`assert_invoice_numbering_regular` and `find_first_missing_invoice_sequence` inspect invoice numbering and can disclose fiscal sequence state. They are P2 metadata endpoints in isolation, while the direct invoice exposure already makes the overall incident P0.

`backfill_invoice_fiscal_snapshots` and `save_invoice_with_lines_v2` are `SECURITY DEFINER`, use a fixed `search_path`, and call the authenticated financial guard before mutation. The source review therefore did not establish an anonymous write bypass, but their public EXECUTE grant is unnecessary P2 attack surface and should be revoked.

The remaining formatting/extraction helpers do not read business rows and are P3 by themselves, but there is no product reason to expose them remotely to anon.

### QA difference

QA has 24 non-trigger functions executable by anon. In addition to the production set, anon can reach grants for:

- `accept_quote_workflow`
- `convert_lead_to_client`
- `record_audit_event`
- `refresh_invoice_payment_status`
- `require_authenticated_financial_write`
- `save_invoice_with_lines`
- `save_lead_quote_with_lines`
- `save_payment_and_refresh_invoice`
- `save_quote_with_lines`
- `settle_invoice_by_transfer`
- `update_invoice_status`
- `update_quote_status`

Source inspection found an internal `auth.uid()` or authenticated financial guard on these QA functions. No anonymous mutation was attempted. Production is stricter because these twelve grants are not effective for anon there. QA must converge to an explicit RPC allowlist rather than preserve broader default EXECUTE privileges.

Trigger and event-trigger functions also inherit public EXECUTE in the catalogs (15 in production and 15 in QA), but their pseudo-type contracts do not make them normal PostgREST RPC calls. Their grants should still be normalized as defense in depth.

## App exposure

The authenticated app shell prevents normal UI navigation without a session, but the data API is independently public:

- `src/lib/supabaseRest.ts` falls back to the anon key as `Authorization: Bearer` when no access token is supplied.
- Most internal list readers in `src/app/appDataApi.ts` do not pass an access token for leads, clients, properties, quotes, jobs, invoices, invoice lines, or payments.
- `src/features/leads/LeadDetailCard.tsx` also contains an anon-bearer lead update path. That write finding is outside this read-audit correction scope and must be included in the next security gate.
- `scripts/ops/audit-fiscal-second-semester.mjs` reads invoices, payments, clients, and invoice lines with the anon key. It must migrate to an authenticated operator session before anon reads are closed.

Therefore hiding the app behind `AuthPage` is not a security boundary for the REST API. Anyone holding the public project URL and intended-public anon key can address the exposed resources directly.

## Other critical policy debt discovered

Although this sprint did not audit or exercise writes, catalog inspection found legacy anon-applicable write policies on `invoices`, `payments`, `leads`, `quotes`, `quote_lines`, and `invoice_lines`, plus expected public submission policies on `intake_submissions` and quiz attempts. This is a separate P0 write-policy finding. No write was attempted, and no financial function, invoice number, payment, or closing was changed.

## Proposed correction — not applied

The safe correction is coordinated; changing policies alone would break current readers that still use the anon bearer.

### Phase 1: frontend and tooling, local source only

1. Make internal REST reads fail closed without `session.access_token`.
2. Propagate the authenticated token to every internal list/detail reader.
3. Migrate operator scripts away from anon-bearer access.
4. Replace the lead anon update path with the authenticated RPC/write helper.
5. Preserve only explicitly public submission flows, with narrow payloads and no public history read.

### Phase 2: reviewed QA migration

1. Drop the ten anon/public `SELECT USING (true)` policies.
2. Revoke SELECT from `anon` and `PUBLIC` on all internal public-schema tables, including grant-only tables.
3. Add narrowly named `TO authenticated` SELECT policies for the current single-workspace model, or stop for a tenancy design before multi-workspace use.
4. Revoke function EXECUTE from `PUBLIC` and `anon`, then grant only the RPC allowlist required by `authenticated` and the intentional public intake flow.
5. Remove legacy anon write policies in the separately authorized write-policy scope; do not combine that work with fiscal behavior changes.
6. Refresh PostgREST schema cache through the approved mechanism and verify catalog plus live REST behavior.

### Phase 3: QA acceptance before production authorization

- anon GET/HEAD to every internal table is denied, not merely HTTP 200 with zero rows;
- authenticated reads still load every app module;
- public intake and quiz submission work without exposing stored submissions;
- anon RPC allowlist is empty or explicitly justified;
- authenticated visual QA and dry-run pass;
- no invoice, payment, closing, numbering, or full-submit write occurs;
- QA and production catalog differences are documented before a separate production release gate.

## Rollback

This audit changed documentation only. Repository rollback is `git revert <audit-commit>`. No database rollback exists or is needed.

For a future QA correction, rollback must restore the exact pre-change policies/grants from a private catalog export, not recreate broad `USING (true)` policies from memory. Production rollback requires separate authorization and must never be inferred from this report.

## Recommended next gate

**P0 Authenticated Read Path And Anonymous Policy Closure in QA.** Deliver the frontend token propagation and a reviewed QA-only migration together. Stop before production. Include the legacy anon write-policy findings in the migration review, but keep invoice/payment behavior, numbering, fiscal state, and full-submit strictly non-mutating during validation.
