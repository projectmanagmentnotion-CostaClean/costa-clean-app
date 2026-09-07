# Costa Clean App V3 — Functional Inventory

Status: discovery complete from the current repository at `3668c7b`. This document describes behavior to preserve, not the current visual layout.

## System-wide contracts

- Authenticated shell is bootstrapped by `src/app/AppShell.tsx`; public quote request and public quiz remain separate entry points.
- Supabase is the source of truth for clients, properties, leads, quotes, jobs, invoices, payments, expenses, closings, audit events, alerts and notifications.
- Protected writes use the existing authenticated RPC/write adapters. V3 must not write directly to financial tables or bypass RLS.
- Existing URL/query routing, deep links, navigation guards, unsaved-change prompts, PDF generation, numbering, lifecycle and duplicate-review contracts remain behaviorally stable.
- Mobile is the redesign source of truth. Desktop and iPad are later compositions of the approved mobile language.

## Module inventory

### Home

- Purpose: operational overview, urgent work, balances, alerts, agenda and next actions.
- Needs: counts and summaries from leads, quotes, jobs, invoices, payments, expenses, alerts and fiscal data.
- Frequent actions: open the highest-priority item, review alert, open pending collection, open follow-up, navigate to a module.
- Secondary actions: theme, notifications, account, sync state, fiscal-period context.
- States: loading, empty, error, operational summary, stale/sync indication.
- Relations: every primary card deep-links to the source entity/module.
- V3 opportunity: make the first screen a short priority queue rather than a dashboard of competing KPI cards.

### Leads

- Purpose: capture and review demand before commercial conversion.
- Needs: requester identity/contact, request context, status, source, timestamps, assigned follow-up and linked intake/draft.
- Frequent actions: open lead, contact/review, mark or persist review state, convert to client, open related quote.
- Secondary actions: archive/lifecycle, duplicate review, reopen, open source intake.
- States: new, pending review, contacted/reviewed, converted, archived, duplicate candidate, empty/error.
- Relations: intake/draft → lead → client → quote.
- V3 opportunity: workspace should answer “what is the next human decision?” without exposing CRM internals.

### Clients

- Purpose: canonical customer directory and relationship hub.
- Needs: identity, contact/fiscal data, status, pending balance, properties, services, quotes, invoices and payments.
- Frequent actions: search/open client, create client, open a pending invoice or service, edit contact/fiscal data.
- Secondary actions: property/service/quote/invoice navigation, duplicate review, recurring plan review, archive/lifecycle.
- States: active/inactive, duplicate candidate, pending balance, recurring plan due, empty/error, unsaved edits.
- Relations: client → properties, jobs/services, quotes, invoices, payments and recurring plans.
- V3 opportunity: use a client workspace as the relationship spine; hide empty secondary domains until relevant.

### Inmuebles / Properties

- Purpose: property context for operational work.
- Needs: name/address/type, client relation, pending balance, quotes, services/jobs and invoices.
- Frequent actions: search/open property, create/edit property, open active service, open client or invoice.
- Secondary actions: duplicate review, lifecycle/archive, related quote/job/invoice navigation.
- States: active, archived, duplicate candidate, with/without services, with/without pending balance, unsaved edit.
- Relations: client → property → job/service and commercial/financial documents.

### Presupuestos / Quotes

- Purpose: create, review, send, accept/reject/expire and convert commercial proposals.
- Needs: client/property context, lines, pricing, status, source job/lead and conversion links.
- Frequent actions: open quote, download PDF, create quote, mark sent, accept and create service, accept and create invoice.
- Secondary actions: edit, duplicate, reject, expire, archive, export CSV, bulk actions and duplicate review.
- States: draft, sent, accepted, rejected, expired, cancelled/archived, accepted without service/invoice, duplicate candidate.
- Relations: lead/client/property → quote → service/job → invoice.
- V3 opportunity: make conversion state and next action primary; keep bulk actions in a contextual selection mode.

### Servicios / Jobs

- Purpose: operational work execution and completion.
- Needs: client/property, schedule/status, lines, notes, source quote, assigned context and invoice relation.
- Frequent actions: open service, create service, change lifecycle/status, complete work, create/open invoice.
- Secondary actions: edit, duplicate, archive/cancel, open client/property/quote/invoice, duplicate review.
- States: scheduled, in progress, completed, cancelled/archived, unbilled, unsaved edit, empty/error.
- Relations: quote → service/job → invoice/payment; service context also belongs to client/property.

### Facturas / Invoices

- Purpose: fiscal document lifecycle, document delivery and collection state.
- Needs: invoice number/display code, client, property/service/quote origin, issue date, lines, total, paid/outstanding, fiscal snapshot and lifecycle.
- Frequent actions: search/open, download PDF from list, mark pending invoice paid through the existing transfer settlement contract, register partial/full collection, inspect document.
- Secondary actions: edit where permitted, duplicate/correct, archive/cancel, bulk download/settlement, fiscal/debug review.
- States: draft, issued/pending, partially paid, paid, cancelled, archived/deleted, numbering/fiscal warning, loading/error.
- Relations: client/property/service/quote → invoice → payments; invoice documents and audit trail.
- V3 opportunity: list → full-screen invoice workspace; one primary action based on financial state and no master-detail on mobile.

### Cobros / Payments

- Purpose: record and inspect collections linked to invoices.
- Needs: invoice, amount, date, method, origin type, client context and resulting invoice balance/status.
- Frequent actions: open collection, register collection, open linked invoice/client.
- Secondary actions: edit/review where permitted, duplicate review and lifecycle support.
- States: manual, automatic transfer settlement, partial/full effect, duplicate candidate, unsaved form, empty/error.
- Relations: payment must remain linked to invoice; financial state is derived from real payments and protected RPCs.

### Gastos / Expenses

- Purpose: record operational expenses and fiscal/document support.
- Needs: supplier, date, category, amount/tax, payment status/method, receipt/document support and fiscal review/risk.
- Frequent actions: create expense, inspect support, classify/review, open document.
- Secondary actions: edit, duplicate, archive/lifecycle, duplicate review and export/closing navigation.
- States: pending/reviewed, support present/missing, fiscal risk, archived, unsaved form, empty/error.
- Relations: expenses feed quarterly/annual closings and document/support exports.

### Alertas

- Purpose: turn detected operational/data problems into a readable decision queue.
- Needs: severity, bucket, count/fingerprint, action label, read/decision status and linked module/entity.
- Frequent actions: open alert target, mark read, acknowledge critical alert, dismiss/reopen decision.
- Secondary actions: filter all/pending/critical/resolved and open the full center from the bell.
- States: critical, action, follow-up, info, resolved/dismissed, empty.
- Relations: alert fingerprint and decision persistence must survive reload and deep-link to the source.

### Cierres / Fiscal closing

- Purpose: quarterly and annual fiscal review, snapshot and export preparation.
- Needs: selected year/quarter, invoice/payment/expense aggregates, missing support, incidents, notes, saved snapshot, manager pack and AI/internal study data.
- Frequent actions: inspect primary incidence, navigate to invoices/payments/expenses, save snapshot, review support, download export package.
- Secondary actions: quarterly/annual switching, dossier, export folder, internal study, AI summary and document preview.
- States: period selected, incomplete support, risk/incidence, saved snapshot, export in progress/error.
- Relations: closing reads canonical financial/expense data and must not change numbering or financial write behavior.

### Configuración / secundarios

- Account: identity, sign out and notification enable/disable state.
- Theme: light/dark preference.
- Notifications: browser permission/state and push subscription lifecycle.
- Duplicates/audit/integrity/debug: control surfaces for review and support, secondary to operational work.
- Public routes: quote request and quiz are outside the authenticated bottom navigation and retain their own contracts.

## Cross-cutting capabilities to preserve

- Search, module filters, sorting, clear-filter behavior and persisted list preferences.
- Multi-selection mode and bulk downloads/exports/status/lifecycle actions where already implemented.
- Full-screen/overlay create and edit flows, first-field visibility, keyboard-safe CTA placement and navigation guards.
- PDF/document previews and downloads without requiring detail navigation where a direct list action exists.
- Duplicate review, alert decisions, audit events, recurring invoice plan relations and all protected financial/fiscal boundaries.

## Explicit V3 simplification candidates

- Merge repeated KPI/checklist blocks into a priority queue with one next action.
- Move advanced filters from permanent desktop-like toolbars into mobile bottom sheets.
- Flatten nested cards and make relationship sections conditional/quiet.
- Put rare actions in `Más`; leave one primary consequence and at most 2–3 quick actions in each workspace.
- Keep the current implementation as behavioral source of truth, not visual source of truth.
