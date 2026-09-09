# V3 Design Guardian — V3-3C

Status: `V3-3C CLOSED / CERTIFIED`

## Review boundary

The guardian reviews the V3 shell, invoice, quote and client
list/workspace against the
approved Stitch Editorial Simplified reference. It is a reviewer, not a source
of screen-specific invention. New V3 screens must reuse the existing tokens,
buttons, inputs, status, sections, rows, workspace, navigation and sheet
contracts before any extension is considered.

## Evidence

- QA target: Supabase QA project `kpvvydthlxupjjqqdpxy`.
- Browser context: independent `costaclean-v3`.
- Reference: approved Stitch project `6884707630640107069`.
- Private screenshots: `.auth/costaclean-v3/` (ignored; not committed).
- Viewports reviewed: `390x844`, `430x932`, `768x1024`.
- Runtime storage unblock: private QA `expense-receipts` bucket with signed URLs;
  no visual contract changes.
- V3-3C final authenticated run: Alerts, Closing issues, Closing ready, saved
  quarter/year snapshots and More sheet reviewed at the required viewports.
- Bottom dock geometry: `getBoundingClientRect()` reported `0` overlap across
  the ten V3 modules at `390x844`, `430x932` and `768x1024`.
- Exact QA cleanup: temporary `qa_cleanup_v3_3c_fixture(...)` returned
  `qa_only: true`; all targeted fixture tables and audit events verified at `0`.

## Gate scores

| Gate | Score | Result |
| --- | ---: | --- |
| Layout | 94 | PASS |
| Typography | 92 | PASS |
| Spacing | 92 | PASS |
| Controls | 94 | PASS |
| Lists | 93 | PASS |
| Workspace | 94 | PASS |
| Navigation | 94 | PASS |
| Overall | 93 | PASS |

Validated details: flat invoice rows, editorial KPI hierarchy, shared button
geometry, status placement, section dividers, bottom navigation, More sheet,
filter sheet, safe-area padding and no horizontal overflow.

## Static guardian

- Hardcoded V3 colors outside `src/v3/design/tokens.css`: `0`.
- Forbidden legacy visual classes in the dedicated V3 tree: `0`.
- Legacy visual dependency in the rendered V3 invoice tree: `0`.
- Legacy visual dependency in the rendered V3 Home tree: `0`.
- Legacy visual dependency in the rendered V3 Alerts and Closings trees: `0`.
- Fake alert lifecycle/settings/fiscal certification claims in new V3 trees: `0`.
- Home queue entries at maximum: `3`.
- `prefers-reduced-motion`: covered by the V3 stylesheet.
- Bottom dock clearance: tokenized through `--v3-bottom-nav-clearance`; no
  hardcoded `96px` remains in the V3 content clearance contract.

## V3-3A Home evidence

- Home Negocio hoy: PASS at `390x844`, `430x932` and `768x1024`.
- Legacy dashboard visual dependency: `0` when `?v3=1`.
- Hero and three secondary KPIs: PASS; values come from `dashboardMetrics`.
- Priority queue: PASS; deterministic critical-first ordering and alert/incident deduplication.
- KPI routing: PASS; invoice, quote and job destinations preserve their module filter context.
- Existing alert and operational action routing: PASS.

## V3-3B secondary financial evidence

- Dedicated Payments and Expenses trees: implemented; final authenticated
  workspace/create/edit certification pending.
- Legacy visual dependencies in the V3 trees: `0` by static guardian.
- Payment origin guard: `transfer_auto` remains an internal origin and is not
  editable through the generic manual-payment editor.
- Expense document and fiscal copy: assistive/internal semantics preserved;
  certification language is not rendered.

## Real flow evidence

- Auth session and reload: PASS.
- PDF download from invoice list: PASS; real PDF generated.
- Settlement: PASS; one real payment recorded and outstanding became `0,00 €`.
- Paid workspace and reload persistence: PASS.
- Deep link with `v3=1&view=invoices&invoice=...`: PASS.
- Back restoration of filter/search/scroll context: PASS.
- QA fixture cleanup: PASS; residue verified `0`.

Production was not accessed or modified.

## V3-3C final verdict

Alerts and Closings are `CLOSED / CERTIFIED`. V3-3D is not started and needs a
separate human approval.

## V3-2A client evidence

- Client list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Real QA rows and relations: PASS; invoice balance and historical totals came
  from existing invoice/payment data.
- WhatsApp, call and email: PASS with valid contact data; invalid contact data
  is guarded and hidden.
- Invoice prefill: PASS; existing financial create flow selected the client.
- Quote prefill: PASS; existing commercial quick flow opened with client
  context.
- Client deep link/back: PASS; `client=<id>` opened the workspace and back
  restored the client list.
- Legacy visual dependency in `src/v3/clients`: `0`.
- Hardcoded V3 colors outside tokens: `0`.

## V3-2B quote evidence

- Quote list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Real quote lines and relations: PASS; client, property, job and invoice
  references are rendered only when present in the existing data contracts.
- Quote PDF download: PASS; existing renderer produced the real PDF.
- Share capability and fallback: PASS; unit coverage verifies the native PDF
  `File` payload and local download fallback without external upload.
- Quote-to-invoice conversion: PASS; existing workflow preserved `quote_id`,
  lines, VAT/total, duplicate protection and invoice navigation.
- Quote deep link/back restoration: PASS.
- Legacy visual dependency in `src/v3/quotes`: `0`.
- Hardcoded V3 colors outside tokens: `0`.
- QA fixture cleanup: PASS; quote, quote lines, invoice and invoice lines
  residue verified `0`.

## V3-2C lead evidence

- Lead list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Real statuses and relations: PASS; only `new`, `contacted`, `quoted`,
  `won`, `lost` and archived are exposed.
- Neutral WhatsApp, call and email: PASS through the shared V3 contact helper;
  invalid values remain hidden.
- AI draft review: PASS; `markLeadDraftReviewed()` persisted
  `ai_draft_status = 'reviewed'` across reload.
- Business lead review fake state: `0`; no `reviewed_at` or `reviewed_by` was
  added or inferred.
- Quote from reviewed draft: PASS; real quote linked to `lead_id` and intake.
- Client conversion: PASS; real client linked through `source_lead_id`, lead
  became `won`, and the second conversion path exposed the linked client rather
  than creating a duplicate.
- Edit/status/archive/regenerate paths: PASS through existing authenticated
  write contracts; regeneration requires a fresh draft review.
- Lead deep link/back restoration: PASS.
- Legacy visual dependency in `src/v3/leads`: `0`.
- Hardcoded V3 colors outside tokens: `0`.
- QA fixture cleanup: PASS; lead, draft, intake, quote, quote lines, client
and targeted audit events residue verified `0`.

## V3-2D service evidence

- Services list and workspace: PASS at `390x844`, `430x932`, `768x1024`.
- Today, upcoming, completed and archived filters: PASS from real job status/date/lifecycle data.
- Billing state and client/property/quote/invoice/payment relations: PASS.
- Completed unbilled service to invoice: PASS through the existing prefill/create contract; duplicate eligibility is guarded.
- Work Report PDF: PASS; real PDF bytes generated from service data.
- Share and local fallback: PASS through `shareDocument()` and existing PDF delivery helpers.
- Edit/status/archive and deep-link/back restoration: PASS through existing authenticated contracts.
- Fake work-report claims: `0`; no signature, execution certification, GPS, tracking or telemetry state is rendered.
- Legacy visual dependency in `src/v3/jobs`: `0`.
