# V3-10C4.4 — Payments refinement

Status: `CLOSED / CERTIFIED`

## Bounded presentation scope

This slice refines only the V3 Cobros list and available payment workspace:

- payment amount, invoice, client, date, method and provenance scan order;
- local provenance filtering using existing `origin_type` values;
- explicit provenance wording for manual, automated-transfer and historical
  regularization records;
- one primary invoice action and grouped relationship actions;
- removal of the duplicate sticky invoice CTA.

`transfer_auto` is presented strictly as transfer provenance. It does not
claim reconciliation, settlement or invoice liquidation.

## Protected contracts

The following are intentionally unchanged:

- `PaymentCreateFlow` and payment persistence;
- `savePaymentAndRefreshInvoice` and invoice refresh behavior;
- `transfer_auto` semantics and generated-record read-only boundary;
- duplicate protections, permissions, totals and status semantics;
- invoice/payment relationships and all settlement contracts;
- Supabase, schema, remote data and production.

## Source-level evidence

- `paymentPresentation.ts` maps existing origin values to user-facing
  provenance labels and explanations without changing origin data.
- Automated and historical-transfer descriptions expressly state that they do
  not confirm reconciliation or liquidation.
- The list filters only existing origin values locally; it adds no backend
  filter, status or reconciliation state.
- The workspace retains existing manual-edit wiring but exposes no edit action
  for generated records.
- Focused presentation tests cover provenance wording, manual/generated edit
  eligibility, invoice/client context and the single invoice CTA.

## Authenticated read-only runtime evidence

The canonical `.auth/costaclean-v3/qa-browser-profile` was reopened with the
repository-supported `qa:auth:setup` harness at
`http://127.0.0.1:4178/?v3=1`. The newly launched browser detected the
authenticated shell without reading, copying or printing credentials, cookies,
tokens or browser storage. This proves persisted-profile restart reuse.

The read-only Payments replay passed at `390x844`, `768x1024` and `1440x900`:

- authenticated `Cobros` list and V3 route loaded at all three sizes;
- reload/re-hydration passed at all three sizes when evaluated with the
  harness shell-stability wait rather than a fixed delay;
- the local existing-origin filter passed; the dataset had no visible payment,
  so search match/miss, workspace, provenance on a real row, deep link and
  Back are `N/A` without creating a fixture;
- the rendered create and origin/sort controls were at least `48px` tall;
- horizontal overflow, visible UUIDs, Unicode-as-icon, legacy markers and
  broken assets were `0`;
- console errors, page errors, failed critical requests, production requests,
  production mutations and QA business mutations were `0`.

The `Más` dialog Escape/focus contract passed where the mobile/tablet control
is rendered; desktop rail navigation has no equivalent `Más` dialog and is
`N/A`. No payment creation, settlement, reconciliation, document action or
other financial mutation was invoked.

The private runtime artifact is
`qa-reports/private/v3-10b/v3-10b-auth-audit.json`; it contains no committed
customer evidence. The final independent V6 quality gate passed. C4.5 has not
started.

## Independent-gate remediation in progress

The first independent review found a real 320px defect: the payments-specific
three-column control rule had greater specificity than the shared mobile
fallback, collapsing the search track even without document overflow. The
mobile selector now overrides that rule explicitly. A fresh authenticated
read-only replay confirmed a single `268px` track at `320x568`, `48px`
relevant control heights, zero overflow and stable reload.

The same review also found a duplicate invoice-navigation affordance in the
workspace and insufficient focused coverage. The duplicate relation action was
removed; the existing primary `Ver factura` action is the sole invoice
navigation affordance. Focused tests now cover the local origin filter and the
manual-versus-generated edit boundary. These corrections await a fresh
independent gate.

## Independent gate resolution

The historical Windows limitation was resolved with the versioned CP-2A.5 / V6
compatibility package rather than by editing hash-locked V3/V4/V5 evidence. V6
uses an allowlisted temporary profile and cache, supplies exactly one process-
scoped `safe.directory` entry for this repository, and verifies a static
canonical V3/V4/V5 artifact registry before it invokes the three equivalent
infrastructure proofs. It does not set global Git configuration or expose an
execution, preflight, QA-write or production path.

An independent `pr-quality-gate` ran the V6 test/proof under the managed
Windows sandbox and recorded `PASS` in the ignored artifact
`.project-agent/private/cp2a5-sandbox-review.md`. Its subsequent review found
that system Git configuration still needed explicit suppression and that V5
hash verification needed to be transitive. V6 now sets `GIT_CONFIG_NOSYSTEM=1`,
checks the effective `safe.directory` origin, and re-verifies every artifact
declared by the hash-pinned V5 manifest. The final independent rerun passed.

The applicable independent sandbox gate is therefore the versioned V6 proof,
not an unmodified direct execution of the historical stripped-environment V4
test. The host full suite remains a separate full-regression gate. The final
scope review recorded `PASS` with no P0–P3 findings in
`.project-agent/private/c4-4-cp2b-v6-scope-review-retry.md`. C4.4 is closed;
C4 remains open and C4.5 has not started.
