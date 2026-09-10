# Costa Clean App V3 — V3-3D Implementation Contract

Status: `CLOSED / CERTIFIED — V3-3D PROPERTIES + RELATIONS`.

Base commit: `09d923622bc2053f2fce46abacc666d9f934e60c`

## V3-3C closure evidence

- Authenticated QA target: `kpvvydthlxupjjqqdpxy`; production was not accessed.
- Alert runtime was previously certified; no prior alert fixtures were recreated.
- A new isolated `QA V3-3C` fiscal fixture reached `Listo` for T4 2024 and
  persisted both quarterly and annual snapshots across reload.
- The temporary QA-only `qa_cleanup_v3_3c_fixture(...)` RPC removed the exact
  client, invoice, payment, expense, quarterly snapshot and annual snapshot;
  post-cleanup verification returned zero rows and zero targeted audit events.
- Bottom navigation geometry returned zero overlap at `390x844`, `430x932` and
  `768x1024` across Home, Invoices, Clients, Quotes, Leads, Services, Payments,
  Expenses, Alerts and Closings.
- Regression gates: `649 passed`, `4 skipped`, lint PASS and build PASS.
- V3-3D is not included in this contract and requires separate approval.

## Scope

V3-1R replaces the earlier CSS adaptation with an independent V3 presentation
tree. The repository remains the functional source of truth. Existing `AppView`,
query parameters, Supabase reads/writes, invoice numbering, PDF generation and
payment settlement contracts remain authoritative.

QA activation is explicit with `?v3=1`. Without that query parameter the V2
shell remains available during migration. The flag is presentation-only and is
never used as business state or persisted in local storage.

Expense support storage is the private QA bucket `expense-receipts`, limited to
PDF/JPEG/PNG/WEBP files up to 10 MB. Internal staff policies constrain objects
to the existing `expenses/<expenseId>/<timestamp>-<filename>` path contract;
the UI reads documents through signed URLs. Provisioning is versioned in
`supabase/migrations/20260908143530_expense_receipts_storage.sql` and was
applied only to QA. Exact fixture deletion is isolated to the local
`scripts/qa/cleanup-v3-3b-fixtures.mjs` harness and is not exposed through the
product API.

## Real actions kept

- Invoice PDF download uses the existing `downloadInvoicePdf` / PDF output path.
- Invoice settlement uses `canSettleInvoiceByTransfer`, the settlement guard,
  `settleInvoiceByTransfer` and payment refresh. The UI never writes
  `status = 'paid'` directly.
- Invoice list filtering continues to use `ListToolbar` and
  `ModuleFilterState`; V3 adds presentation around the existing state only.
- Entity navigation continues to use the existing `AppView` and workspace
  contracts.

## Dedicated V3 tree

- `src/v3/shell/V3ShellChrome.tsx` owns the V3 top bar, bottom navigation and
  More sheet.
- `src/v3/invoices/V3InvoicesPage.tsx` owns the V3 invoice list, row and
  full-screen workspace.
- V3 invoice markup does not render `hero-card`, `cc-master-layout`,
  `OperationalListItem`, `cc-record-card` or `cc-list-toolbar`.
- Legacy `InvoicesPage` remains the V2 branch only; it is an orchestration
  boundary and retains the real callbacks/APIs.
- `src/v3/clients/` owns the V3 client list, client workspace and contact action
  presentation. It does not import legacy list/workspace visual components.
- `src/v3/quotes/` owns the V3 quote list, filters, rows and full-screen quote
  workspace. Quote lines are loaded from the existing `quote_lines` contract;
  no visual quote fixture is used as source of truth.
- `src/v3/leads/` owns the V3 lead list, row and full-screen commercial
  workspace. It does not import `LeadsList` or `LeadDetailCard`; legacy
  `LeadsPage` remains an orchestration boundary for the non-V3 branch and
  existing create-flow business contract.
- Client relations are derived from existing IDs. Financial totals use current
  invoice/payment data; no LTV, margin, delivery or tracking state is invented.

## V3-2A useful actions

- WhatsApp uses a normalized `wa.me` URL with optional contextual text.
- Call uses a validated `tel:` URL.
- Email uses a validated `mailto:` URL.
- New invoice and new quote use the existing create flows and client prefills.
- No action claims sent, delivered, read, verified, GPS, tracking or telemetry.

## V3-2C lead and intake actions

- Neutral WhatsApp, `tel:` and `mailto:` actions reuse `V3ContactActions` and
  show only when the existing contact value is valid.
- Intake data is summarized from `normalized_input`, `quote_draft_seed` and
  `pricing_breakdown`; raw JSON is not rendered as a visual source of truth.
- Manual draft review calls `markLeadDraftReviewed()` and persists only
  `lead_drafts.ai_draft_status = 'reviewed'`. This is explicitly different
  from business review of the lead: there is no `reviewed_at`, `reviewed_by`,
  `lead.status` alias or alert/read state used for that meaning.
- Quote creation calls `convertReviewedLeadDraftToQuote()` and preserves the
  real `lead_id`, `intake_submission_id`, pricing metadata, VAT and lines.
- Client creation/linking calls the existing reviewed-draft/client conversion
  contract and keeps duplicate protection, `source_lead_id` and
  `converted_client_id` authoritative.
- Edit, status, archive/restore and regeneration call existing write APIs;
  regeneration resets the draft to `drafted`, requiring a new review.

## V3-2B document and conversion actions

- Quote PDF download uses the existing quote renderer.
- Share builds a local `File` from that PDF and uses `navigator.share`/
  `navigator.canShare` when available; the fallback downloads locally. No
  external upload, delivery tracking or read state is invented.
- Quote-to-invoice uses `accept_quote_workflow` with the real quote id, lines,
  VAT and duplicate protection. The resulting invoice keeps the `quote_id`
  relation and refreshes the invoice workspace data.
- Quote deep links use `quote=<id>` and browser history; back returns to the
  quote list and clears the module deep-link state.

## Design Guardian checks

The V3 Home surface lives in `src/v3/home/` and owns one hero KPI, exactly
three secondary KPI actions and a capped priority queue. It consumes
`dashboardMetrics`, existing alert decisions and operational action handlers;
it does not create a second accounting model. Home KPI actions use the existing
`dashboardKpiActionConfig`, and invoice/quote/job destinations receive the
active module filter context.

### V3-3A Home contract

- Hero: `metrics.invoicedThisMonthTotal`, routed by `invoiced_this_month`.
- Secondary KPIs: outstanding receivables, open quotes and completed jobs
  without invoice; no targets, margins, LTV, forecast or synthetic financial
  values are rendered.
- Priority queue: active critical/warning automation alerts plus operational
  incidents, deterministic severity ordering, maximum three entries, and
  suppression when the same domain is already represented by an alert.
- Empty state is explicit and quiet. Alert actions continue through the
  existing alert decision/router contract; incidents continue through the
existing operational action contract.

## V3-3B secondary financial surfaces

- `src/v3/payments/` owns the flat payment list, row and full-screen workspace.
  Payments remain auxiliary to invoices and every row requires the existing
  `invoice_id` relation. `transfer_auto` is displayed only as an internal
  origin; it is never called a confirmed bank transfer or reconciliation.
- `src/v3/expenses/` owns the flat expense list, row and full-screen workspace.
  The workspace keeps support, fiscal review, payment and deterministic data
  separate without card soup or a second persistence model.
- Existing `PaymentCreateFlow`, `savePaymentAndRefreshInvoice`, duplicate
  guards, `ExpenseCreateFlow`, `ExpenseEditFlow`, attachment APIs and fiscal
  intelligence APIs remain the source of truth for writes.
- Manual payments may be edited through the existing write contract. Automatic
  settlement records are read-only in V3.
- Expense document copy is internal: `Soporte marcado como factura válida` is
  not an AEAT or fiscal certification. AI output is always labelled
  `Estimación fiscal asistida` and remains secondary to deterministic values.
- Payment and expense deep links are `payment=<id>` and `expense=<id>`; module
  filters continue to be supplied by `PaymentModuleFilter` and
  `ExpenseModuleFilter`.

`scripts/quality/v3DesignGuardian.test.mjs` verifies the dedicated V3 tree has no
forbidden legacy visual names or hardcoded component colors. Token values live in
`src/v3/design/tokens.css`; geometry, touch targets, safe areas and motion rules
live in the V3 stylesheet.

## Hidden-until-real policy

V3 does not expose Parte de Trabajo PDF or business-lead “revisado” state
without a source-of-truth contract. No fake delivery, read, verification, GPS,
telemetry, eIDAS or IBAN state is rendered.

## Deep-link and back contract

The V3 invoice surface accepts the existing `view` and invoice filter context,
plus `invoice=<id>` for a direct invoice workspace entry. Navigation changes are
written to browser history; back restores the previous app view and retains
existing list preferences. The invoice filter remains a real module filter, not
opaque local-only routing state.

## QA contract

- Primary: `390x844` and `430x932`.
- Regression: `768x1024` and desktop no-regression.
- Targets: at least 44px, preferably 48px.
- `prefers-reduced-motion`, safe-area insets, focus visibility and bottom-sheet
  Escape/dismiss/scroll-lock behavior are mandatory.
- No production deploy, migration, production write or main-branch change.

## V3-2D service and work-report actions

- `src/v3/jobs/` owns the services list, operational row and full-screen
  workspace, using real status, billing, relation and lifecycle contracts.
- Completed unbilled services use `buildInvoiceCreatePrefillFromJob()` and the
  existing invoice create flow; an active invoice relation blocks duplicates.
- Work Report PDF is generated from real service data and delivered locally or
  through the existing native-share fallback. It is an operational summary,
  not a certification, signature, GPS, tracking or telemetry surface.

Final authenticated visual certification is recorded in
`docs/V3_DESIGN_GUARDIAN.md`. V3-3 is the next separate sprint.

## V3-4A selection contract

Selection state is ephemeral UI state only. It resets on search, filter and
module changes, prunes against the current dataset, and is never stored in the
URL, localStorage or Supabase. Invoices expose only existing PDF ZIP, CSV and
eligible settlement contracts. Quotes expose only existing PDF ZIP and CSV
contracts. Bulk settlement uses the existing eligibility and settlement RPCs.

V3-4B adoption allowlist is exact: `Invoices`, `Quotes`. All other modules
remain selection-free until a separate real-contract decision approves them.

## V3-5 responsive shell contract — CLOSED / CERTIFIED

At 768px and 834px the certified bottom navigation remains the only primary
navigation. At 1024px and wider iPad targets, the same navigation model is
rendered as a compact rail; it does not introduce a second route state or
duplicate More content. Selection clearance changes only with the responsive
layout contract and remains token-backed. V3-5 authenticated certification
passed `384/384` checks, with mobile regression and landscape orientation
included.
