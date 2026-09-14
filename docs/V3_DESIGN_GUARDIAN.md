# V3 Design Guardian — V3-3D

Status: `V3-6R GLOBAL CLOSED / CERTIFIED — exact viewport matrix deferred to V3-8`

## V3-3D property certification

- Native V3 property creation/edit: PASS.
- Legacy property presentation dependency: `0`.
- Forbidden legacy property creation dependencies: `0`.
- Mobile main legacy surfaces: `0`.
- Exact QA relation cleanup: residue `0`.

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

- Dedicated Payments and Expenses trees: list, workspace and create/edit
  runtime certification PASS.
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

## V3-4A selection evidence

- Selection foundation and eligibility: PASS; UI-only state, no persistence.
- Invoice runtime: PASS; 2 eligible and 1 ineligible, exactly one
  `transfer_auto` settlement per eligible invoice, and no new payment for the
  paid invoice.
- Invoice and quote ZIP/CSV exports: PASS through existing generators.
- Reset, dataset pruning and selection dock geometry: PASS; overlap `0` at
  `390x844`, `430x932` and `768x1024`.
- Exact QA cleanup via `qa_cleanup_v3_4a_fixture(...)`: PASS; all residue `0`.

## V3-4B adoption audit

- Adopted allowlist: `Invoices`, `Quotes` only.
- Selection clones: `0`.
- Remaining modules audited and not adopted: Jobs, Expenses, Payments, Leads,
  Clients, Properties, Alerts and Closings.
- Fake bulk actions: `0`; legacy bulk toolbar in V3: `0`.

## V3-5 responsive shell evidence — CLOSED / CERTIFIED

- Responsive shell contract: PASS in source and geometry checks.
- 768/834 bottom navigation and 1024+ rail are mutually exclusive by CSS.
- Horizontal overflow: `0` in checked shell viewports.
- Full authenticated surface matrix and orientation regression: PASS (`384/384`).
- 768/834 bottom navigation, 1024+ rail, More, native forms, selection flows
  and mobile regression were certified with zero horizontal overflow.

## V3-6 desktop system evidence — CLOSED / CERTIFIED

- Shared shell/router: PASS; no desktop shell, router or module forks.
- Desktop rail/content tokens: PASS at 1280px and above.
- Selection allowlist remains exact: Invoices and Quotes only; clones `0`.
- Fake Settings and legacy desktop toolbar resurrection: `0`.
- Authenticated matrix: `1536/1536` checks passed; horizontal overflow, rail
  overlap, selection overlap and clipped dialog checks: `0`.
- Mobile/iPad regression: PASS at all five required regression viewports.

## V3-6R financial legacy presentation gate — CLOSED / CERTIFIED

- P0 Services create: PASS; `V3JobCreateFlow` uses V3 primitives and the real
  job write/duplicate contracts.
- V3 navigation improvised Unicode icons: `0`; shell uses `V3NavIcon` vectors.
- Financial V3 runtime reachability audit: PASS for Invoices, Quotes, Payments
  and Expenses. Required legacy DOM markers: `0`; V2-only implementations may
  remain after the `v3Mode` branch.
## V3-6R CRM zero-legacy evidence

- Clients, Leads, Properties and nested Services: native V3 presentation and
  authenticated E2E `PASS`.
- Client/lead/property create and edit contracts, duplicate protection,
  service prefills, relations, deep links and back navigation: `PASS`.
- Legacy CRM runtime markers: `0`.
- Visible UUIDs, accessible/ARIA UUIDs and Unicode-as-icon: `0`.
- Accessibility/focus baseline, QA DB residue and QA Storage residue: `PASS`.
- Static responsive safety: `PASS`; no CRM-specific breakpoint system, width
  contract, desktop fork, second component tree or viewport-specific router.
- Exact CRM viewports `390x844`, `768x1024`, `1280x800` and `1920x1080`:
  `DEFERRED TO V3-8` because deterministic viewport/CDP control is not exposed
  by the current browser environment. This is not an application failure.

`V3-6R CRM ZERO-LEGACY` and `V3-6R GLOBAL` are `CLOSED / CERTIFIED` with the
exact responsive matrix deferred to V3-8.

## V3-6R GLOBAL presentation evidence

- Global root/background: `PASS`; V3 owns `html`, `body` and `#root` from the
  early surface marker through the authenticated shell.
- Boot/preload/auth restoration: `PASS`; V3 global loading and error states are
  accessible, token-backed and contain no legacy boot card or raw technical
  error details.
- AppView, lazy/Suspense, deep-link loading and recovery: `PASS`; V3 branches
  use native status states while existing recovery and navigation logic remains.
- Notification presentation and global confirm: `PASS`; V3 confirmation remains
  `V3ConfirmSheet`, and toast state/placement contracts are unchanged.
- Legacy global runtime: `0`; visible UUID: `0`; accessible UUID: `0`;
  Unicode-as-icon: `0`.
- Reduced motion, accessibility and static responsive safety: `PASS`.
- Non-destructive controlled-browser smoke: `PASS` after reload on Home,
  Invoices, Clients, Services, Payments and Expenses.
- Exact viewport matrix: `DEFERRED TO V3-8`; the controlled browser still does
  not expose deterministic viewport resizing/CDP metrics.

## V3-7A client profile media — CLOSED / CERTIFIED

- Client list avatar: compact 44px initials/photo identity treatment.
- Client workspace avatar: 72px identity treatment with visible mobile actions.
- Profile actions: V3 bottom sheet and V3 confirmation sheet; no legacy modal,
  `window.confirm`, emoji or Unicode control glyph.
- Iconography: `V3Icon` owns camera, replace and trash vectors; changed V3
  client surfaces contain no Unicode-as-icon candidates.
- Private media uses runtime signed URLs and initials fallback; no URL, blob or
  base64 value is stored in the client model.
- QA migration, private bucket and storage policies: `PASS` in
  `kpvvydthlxupjjqqdpxy`.
- Authenticated upload, signed display, reload, replacement, old-object
  cleanup, removal, pointer `NULL` and fallback restoration: `PASS`.
- Exact fixture cleanup: client `CLIENT-DRAFT` / `CLI-0126`, DB residue `0`,
  Storage residue `0`, related entities `0`.
- Accessibility, focus, static responsive safety and V3 confirmation: `PASS`.
- Unicode-as-icon, emoji-as-icon and inline SVG outside `V3Icon`: `0`.
- Exact viewport matrix remains `DEFERRED TO V3-8`; no exact viewport PASS is
  claimed here.
- Production and production Supabase: untouched.
