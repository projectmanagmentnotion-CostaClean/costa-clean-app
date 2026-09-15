# V3-10C4P — FINANCE DISCOVERY AUDIT

Status: `PREPARATION COMPLETE / C4 NOT STARTED`

Repository: `C:\Users\USUARIO\costa-clean-app-v3`
Branch: `codex/app-v3-mobile-first-redesign`
Audited HEAD: `4e3e1ed8237dfe2ab70e62704303f6381744b690`
C3 status: `OPEN — AUTHENTICATED RUNTIME CERTIFICATION PENDING`

This document is a static/read-only discovery audit. No finance product code,
write API, Supabase object, schema, policy, storage object or business data
was changed.

## 1. Protected contract map

| Area | Current contract/evidence | C4 rule |
| --- | --- | --- |
| Invoice settlement | `src/features/invoices/invoiceSettlement.ts`, `canSettleInvoiceByTransfer`; `src/features/financial/financialWriteApi.ts`, `settleInvoiceByTransfer` → `settle_invoice_by_transfer` | Preserve issued + outstanding guard, partial settlement and RPC flow. Never set paid status directly. |
| Quote acceptance/conversion | `src/features/quotes/quoteAcceptanceWorkflow.ts`, `quoteConversion.ts`; `acceptQuoteWorkflow` → `accept_quote_workflow` | Preserve acceptance, conversion and duplicate protection. |
| Payments | `src/features/payments/PaymentCreateFlow.tsx`, `src/features/payments/PaymentCreateForm.tsx`, `savePaymentAndRefreshInvoice` | `transfer_auto` is origin metadata, not reconciliation. Keep it read-only where generated. |
| Expense persistence | `src/features/expenses/expenseApi.ts`, `expenseAttachmentsApi.ts`, `expenseReceiptWorkflow.ts` | Preserve real create/edit persistence, private storage and existing permissions. |
| Expense documents | `EXPENSE_RECEIPTS_BUCKET = expense-receipts`, signed URL creation, `EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024` | Keep private bucket, signed URLs and 10 MB limit. |
| Invoice documents | `src/features/invoices/invoicePdfOutput.ts`, `invoiceDomPdfExport.tsx`, `openInvoicePrintWindow.tsx` | Reuse current PDF/export engine. |
| Quote documents | `src/features/quotes/quotePdfOutput.ts`, `quoteDomPdfExport.tsx`, `openQuotePrintWindow.tsx` | Reuse current PDF/export engine. |

## 2. Architecture inventory

### Invoices

- Page/list/row/workspace: `src/v3/invoices/V3InvoicesPage.tsx`
  (`V3InvoicesPage`, private `V3InvoiceRow`, private `V3InvoiceWorkspace`).
- Create/edit: `V3InvoiceCreateFlow.tsx`, `V3InvoiceEditFlow.tsx`.
- Search/filter/sort: number/client search; `pending`, `paid`, `all`; recent,
  oldest and amount sort; filter bottom sheet.
- Selection/bulk: `useV3Selection`, `V3SelectionPrimitives`; PDF ZIP callback,
  CSV callback and guarded bulk settlement callback.
- Document/payment actions: download, document, view payments, settlement.
- Write/guards: `financialWriteApi.ts`, `invoiceSettlement.ts`,
  `paymentState.ts`, `invoiceWriteTrace.ts`.
- Formatting: `displayFormat.ts`, `relationshipLabels.ts`.
- Tests: V3 page, settlement, payment state, numbering, PDF/output, fiscal
  snapshot, job contract, print-window and financial API tests.
- Shared CSS: `.v3-invoice-controls`, `.v3-invoice-row__*`,
  `.v3-invoice-workspace`, shared `.v3-workspace-*`, `.v3-selection-*`.

### Quotes

- Page/list/row/workspace: `src/v3/quotes/V3QuotesPage.tsx`
  (`V3QuotesPage`, private `V3QuoteRow`, private `V3QuoteWorkspace`).
- Create/edit: `V3QuoteCreateFlow.tsx`, `V3QuoteEditFlow.tsx`.
- Search/filter/sort: reference/client/status search; all, open, accepted,
  rejected and archived; recent, oldest and amount sort; filter bottom sheet.
- Selection/bulk: shared V3 selection; PDF ZIP and CSV callbacks.
- Duplicate review: `V3DuplicateReviewSheet` plus review/ignore/reopen/open
  record callbacks.
- Acceptance/conversion: `quoteAcceptanceWorkflow.ts`, `quoteConversion.ts`,
  `acceptQuoteWorkflow` contract; conversion is enabled by
  `canConvertQuoteToInvoice`.
- Tests: V3 page, conversion, line utilities, scope, PDF/output, document
  screen and print-window tests.
- Shared CSS: `.v3-quote-row__*`, `.v3-quote-workspace`, filter and selection
  primitives.

### Payments

- Page/list/row/workspace: `src/v3/payments/V3PaymentsPage.tsx`,
  `V3PaymentRow.tsx`, `V3PaymentWorkspace.tsx`.
- Create/edit: `V3PaymentCreateFlow.tsx` for V3 entry; legacy-compatible
  `src/features/payments/PaymentCreateFlow.tsx` and `PaymentCreateForm.tsx`
  remain the persistence implementation.
- Search/sort: invoice, client, code or method search; recent, oldest and
  amount sort. No V3 status filter is present in the inspected page.
- Duplicate review: page-level duplicate count/review callback; create and
  edit flows use `findPaymentDuplicateGroups`.
- Relations: payment → invoice; invoice → client; workspace exposes both
  through existing callbacks.
- Tests: V3 payment row, payment deep link, duplicate/financial API coverage.
- Shared CSS: `.v3-payments-page`, `.v3-payment-row__*`,
  `.v3-payment-workspace`, `.v3-module-controls`.

### Expenses

- Page/list/row/workspace: `src/v3/expenses/V3ExpensesPage.tsx`,
  `V3ExpenseRow.tsx`, `V3ExpenseWorkspace.tsx`.
- Create/edit: `V3ExpenseFormFlow.tsx`; underlying persistence is
  `features/expenses/expenseApi.ts`.
- Search/sort: supplier, reference, concept or category; recent, oldest and
  amount sort. No bulk selection is present in the inspected V3 page.
- Attachments: `expenseAttachmentsApi.ts`, `expenseReceiptWorkflow.ts`,
  `ExpenseSupportFieldset.tsx`; upload, replacement, removal and signed-url
  open are real paths.
- Tests: V3 row, expense API, attachment API, receipt workflow, deep link and
  fiscal-intelligence tests.
- Shared CSS: `.v3-expenses-page`, `.v3-expense-row__*`,
  `.v3-expense-workspace`, plus `expense-surfaces.css` and
  `expense-support-fieldset.css`.

## 3. Static UX findings

Severity is design/operational debt for C4, not incident severity.

### F-C4-P1 — safety/meaning ambiguity

1. `getPaymentOriginLabel('transfer_auto')` currently renders
   `Automatico por transferencia`, and the payment workspace renders
   `Origen automático`. The protected contract says this is not reconciliation.
   C4 must make the provenance explicit without inventing a reconciliation
   state or changing the data contract.
2. Invoice settlement is guarded in code, but the list/workspace action label
   is simply `Marcar pagada`. C4 should make the outstanding amount, guard
   eligibility, partial-settlement meaning and result feedback unambiguous.
   The RPC and guard must remain unchanged.

### F-C4-P2 — meaningful operational/composition debt

1. Invoices and quotes place KPI groups before search/filter controls. The
   primary find task is visually below summary analytics.
2. Invoice rows show total and status but not outstanding balance in the scan
   row, even though outstanding is central to the invoice task.
3. Invoice workspace repeats financial reading in the top total, summary,
   line totals and document section; top actions include settlement, edit,
   download and document with no explicit action hierarchy.
4. Quote workspace exposes total, base and IVA together and repeats totals in
   line content; accepted/converted/unavailable conversion states need a more
   explicit explanation while preserving `canConvertQuoteToInvoice`.
5. Payment workspace is clear about invoice relation but the list has no
   status/type filter and the origin label can compete with method/date.
6. Expense workspace contains many sections (summary, document, fiscal,
   payment, data, notes) and a sticky action plus top action. C4 should group
   document/review next steps without hiding the private attachment state.
7. Create flows are real and contract-safe but dense: invoice/quote line
   editors, payment review steps and expense fiscal/document fields all need
   bounded mobile grouping and review ordering before visual certification.

### F-C4-P3 — polish/inconsistency

1. Invoice, quote, payment and expense lists use related but not identical
   search/filter/control compositions and hierarchy.
2. Monetary values use several contexts (`total`, `pending`, `base`, `IVA`,
   paid/collected) without one shared finance reading order.
3. Document actions vary between `Descargar`, `Documento`, `Descargar PDF`,
   `Abrir/ver`, `Reemplazar` and `Añadir documento`; the labels are functional
   but need a consistent action vocabulary.
4. Empty/error/loading language is structurally present, but finance-specific
   guard, permission and document failure copy should be normalized in C4.

## 4. Actual status inventory

- Invoices: raw lifecycle `status` is string; settlement display is
  `Pendiente`, `Parcialmente cobrada`, `Cobrada`, `Cancelada`. Settlement
  eligibility additionally requires `issued`, not archived/deleted/cancelled,
  and outstanding above tolerance.
- Quotes: raw `status` is string; current V3 filters expose all, open,
  accepted, rejected and archived. Create flow exposes draft and sent.
- Payments: `origin_type` includes manual, transfer_auto and
  transfer_regularization; payment methods include transfer, cash, bizum and
  card. The workspace renders Manual vs Origen automático.
- Expenses: payment status paid, pending, partially_paid, cancelled;
  document support missing, ticket, invoice_valid, pending_review; fiscal
  review pending, reviewed, observed; risk low, medium, high; document types
  ticket, factura, recibo, otro.

## 5. Search, filters and selection

- Invoices: search number/client/summary/date; status tabs + sort sheet;
  selection actions are PDF ZIP, CSV and eligible bulk settlement.
- Quotes: search reference/client/status; status tabs + sort sheet; selection
  actions are PDF ZIP and CSV; duplicate review is separate.
- Payments: search invoice/client/code/method + sort; duplicate review entry
  point; no bulk selection.
- Expenses: search supplier/reference/concept/category + sort; no bulk
  selection or filter sheet in the inspected V3 page.

The future bulk UX must keep financial actions behind explicit selection,
show count and eligibility, provide cancel/exit, and never expose raw IDs.

## 6. Create/edit and state coverage

- Invoice and quote flows group relation context, lines, totals, notes and
  duplicate detection; edit flows lock financial identity/unsafe states and
  preserve relations. Dirty-state callbacks exist in quote flows; invoice
  dirty behavior is owned by its parent flow contract and must be verified.
- Payment create flow groups invoice, client readback, date, method, amount,
  notes and review; it checks duplicates and updates invoice state through the
  existing API. V3 payment workspace edits only manual-origin records.
- Expense form groups date, supplier/category, description, document/payment,
  base/IVA, fiscal support/review/risk, notes and optional file; it tracks dirty
  state, checks duplicates, persists first and then uploads an optional
  document. C4 must preserve no-data-loss behavior around upload failure.
- Empty, error and loading paths exist in all four V3 pages; document failure,
  permission failure, duplicate and invalid financial state need a consistent
  future review.

## 7. Relationship map

- Invoice ↔ Client via `client_id` and relationship labels.
- Invoice ↔ Property/Job/Quote via optional ids/display fields and create
  prefill paths.
- Quote ↔ Client/Property/Job/Invoice via workspace links and conversion.
- Payment ↔ Invoice via `invoice_id`, and Client through the invoice.
- Expense ↔ document/support/fiscal state; no invented client/property
  relationship is exposed by the inspected V3 workspace.

All future relationship UI must use display codes/names and existing callbacks,
never raw UUIDs.

## 8. Static accessibility and responsive audit

Positive evidence: V3 pages use labelled search fields/selects, headings and
status primitives; selection controls have labels; document file inputs have
accessible labels; shared action targets retain the C2 44px contract.

Preparation findings:

- `F-C4-P2`: action groups and selection bars must be checked at 320/390/430
  for wrapping, bottom-nav clearance and safe-area behavior.
- `F-C4-P2`: finance rows carry multiple monetary/status lines; verify no
  truncation at 320 and 390 and no desktop sparsity at 1280/1440/1920.
- `F-C4-P3`: filter sheets and create flows should preserve heading, focus,
  Escape and primary-action order across 768/1024 tablet widths.
- `F-C4-P3`: document and financial amount labels need rendered contrast and
  accessible-name verification.

No rendered PASS is claimed in this document. Required runtime replay is the
authenticated 8-viewport matrix described in the implementation plan.

## 9. C2 compliance and scope result

The inspected modules consume C2 V3 primitives and semantic CSS, but contain
module-specific composition drift listed above. C2 is not reopened globally.

Product files changed for this audit: `0`
Business contracts changed: `0`
Supabase: `UNCHANGED`
Production: `UNCHANGED`
Business writes: `0`

V3-10C4 remains `NOT STARTED — PREPARATION ONLY`.
