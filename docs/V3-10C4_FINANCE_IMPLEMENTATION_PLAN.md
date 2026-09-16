# V3-10C4P — FINANCE REFINEMENT IMPLEMENTATION PLAN

Status: `PREPARATION COMPLETE — V3-10C4 PRODUCT IMPLEMENTATION NOT STARTED`

This plan is derived from the read-only discovery in
`docs/V3-10C4_FINANCE_DISCOVERY.md`. It proposes bounded UI/composition work
only. Protected financial, document, duplicate, storage, auth and Supabase
contracts remain frozen.

## Guardrails for every future batch

- No direct status mutation for invoice settlement.
- Keep `canSettleInvoiceByTransfer`, `settleInvoiceByTransfer` and
  `settle_invoice_by_transfer` unchanged.
- Keep `acceptQuoteWorkflow`, `accept_quote_workflow`, duplicate protection and
  conversion lifecycle unchanged.
- Keep `PaymentCreateFlow`, `transfer_auto` provenance and invoice refresh
  semantics unchanged.
- Keep expense persistence, private signed URLs and the 10 MB rule unchanged.
- Reuse current PDF/export engines; no new document service.
- No raw UUIDs, invented reconciliation, invented statuses or fake delivery
  states.
- Mobile first; validate at 320, 390 and 430 before tablet/desktop.

## Ordered implementation batches

### C4.1 — Finance shared hierarchy and list conventions — CLOSED / CERTIFIED

Likely files:

- `src/v3/design/v3.css`
- `src/v3/components/V3Primitives.tsx`
- `src/v3/selection/V3SelectionPrimitives.tsx`
- `src/v3/invoices/V3InvoicesPage.tsx`
- `src/v3/quotes/V3QuotesPage.tsx`
- `src/v3/payments/V3PaymentsPage.tsx`
- `src/v3/expenses/V3ExpensesPage.tsx`

Scope:

- Align search/filter placement, list identity/value/status hierarchy and
  workspace action grouping with certified C2 tokens.
- Define one finance number order: identity → status → primary amount →
  outstanding/paid context → date/metadata.
- Normalize empty, loading, error, selection and sheet language.
- Keep business logic and selection callbacks untouched.

Tests:

- component markup/accessible-name checks for all four lists;
- 44px and selection-bar contracts;
- search miss/clear state tests;
- no UUID/Unicode-as-icon static checks;
- C2 regression suite.

Risk: medium; shared visual changes can regress all finance modules.
Dependency: C3 is closed/certified at `a0c5b60fd0b1431c09204213868b87a2f3567543`.
Product work still requires a separate human-authorized C4 implementation
prompt; this preparation audit is not that authorization.

Completion: `docs/V3-10C4-1_SHARED_FINANCE_HIERARCHY.md`. The completed scope
is controls-before-summary order, shared header/workspace action grouping,
responsive supporting KPIs and common list empty/error states. It does not
change settlement, conversion, payment provenance, expense persistence or
document behavior.

### C4.2 — Invoices and Invoice Workspace — NOT STARTED

Likely files:

- `src/v3/invoices/V3InvoicesPage.tsx`
- `V3InvoiceCreateFlow.tsx`, `V3InvoiceEditFlow.tsx`
- `src/features/invoices/invoiceSettlement.ts` only for read-only contract
  assertions, not implementation changes
- invoice/document tests and V3 page tests

Scope:

- Put find/open task before secondary KPI reading where C2 permits.
- Make total vs outstanding vs paid and settlement eligibility explicit.
- Clarify issued/partial/cancelled/paid states and safe disabled actions.
- Group PDF/document/payment actions without changing callbacks.
- Preserve selection PDF ZIP, CSV and eligible bulk settlement.

Tests:

- settlement guard matrix and busy duplicate guard;
- row/workspace amount hierarchy;
- locked/paid/cancelled/partial render states;
- PDF/document callback wiring;
- selection and bulk eligibility;
- deep link, Back and hard reload runtime.

Risk: high because financial action proximity is safety-sensitive.

### C4.3 — Quotes and Quote Workspace — NOT STARTED

Likely files:

- `src/v3/quotes/V3QuotesPage.tsx`
- `V3QuoteCreateFlow.tsx`, `V3QuoteEditFlow.tsx`
- `src/v3/components/V3DuplicateReviewSheet.tsx`
- existing quote acceptance/conversion tests

Scope:

- Clarify status, total/base/IVA, document actions and conversion availability.
- Make accepted/already-converted/unavailable states explainable without
  inventing a new status or workflow.
- Keep duplicate review, PDF/share, ZIP/CSV and relationship callbacks.

Tests:

- conversion guard and accepted-state regression;
- duplicate review/ignore/reopen rendering;
- relation labels and no UUID;
- selection/export and document callback coverage;
- deep link/Back/hard reload runtime.

Risk: high around duplicate and conversion semantics.

### C4.4 — Payments — NOT STARTED

Likely files:

- `src/v3/payments/V3PaymentsPage.tsx`
- `V3PaymentRow.tsx`, `V3PaymentWorkspace.tsx`,
  `V3PaymentCreateFlow.tsx`
- `src/features/payments/PaymentCreateFlow.tsx` only where V3 presentation
  consumes its existing contract

Scope:

- Improve amount/date/method/invoice/client scan order.
- Make manual vs generated origin explicit; never call `transfer_auto`
  reconciliation.
- Keep duplicate review and invoice refresh behavior.
- Ensure manual edit affordance is absent for generated records.

Tests:

- origin-type read-only rendering;
- duplicate guard and invoice refresh callback;
- relation navigation and missing relation states;
- search/sort/empty state and runtime matrix.

Risk: medium/high due to provenance wording.

### C4.5 — Expenses — NOT STARTED

Likely files:

- `src/v3/expenses/V3ExpensesPage.tsx`
- `V3ExpenseRow.tsx`, `V3ExpenseWorkspace.tsx`, `V3ExpenseFormFlow.tsx`
- `src/features/expenses/expenseAttachmentsApi.ts` and
  `expenseReceiptWorkflow.ts` for regression assertions only
- `ExpenseSupportFieldset.tsx` and expense CSS only if presentation scope is
  explicitly approved

Scope:

- Make supplier/concept/amount/document-support state scannable.
- Group attachment present/absent/upload/replace/view/failure states.
- Preserve dirty confirmation, create/edit persistence, duplicate guard and
  no-data-loss around upload.
- Keep private signed URL and 10 MB validation unchanged.

Tests:

- create/edit dirty and duplicate behavior;
- 10 MB/type validation;
- signed URL callback and attachment preservation;
- document absent/present/error render states;
- no-data-loss runtime replay with authorized QA writes only.

Risk: high because attachments and persistence are destructive/data-loss
boundaries.

### C4.6 — Cross-module regression and responsive certification — NOT STARTED

Scope:

- authenticated read-only replay for all finance surfaces;
- selection, documents, deep links, Back, hard reload and empty/search states;
- independent visual and accessibility review;
- no QA writes unless a later prompt explicitly authorizes exact fixtures and
  cleanup.

Required viewports:

`320x568`, `390x844`, `430x932`, `768x1024`, `1024x1366`, `1280x800`,
`1440x900`, `1920x1080`.

Required states where data permits: populated, empty, search, selection,
workspace, document action, disabled financial action, guard state, deep link,
hard reload.

## Closure criteria

The future C4 closeout requires:

1. each protected contract regression suite PASS;
2. no product/business-contract/Supabase changes outside approved scope;
3. no raw UUID, misleading `transfer_auto` reconciliation claim or blocking
   financial action ambiguity;
4. 44px targets, focus, labels, sheets and keyboard behavior PASS;
5. all eight authenticated viewports PASS with zero overflow, broken images,
   console/page errors and unsafe production requests;
6. independent `pr-quality-gate` PASS;
7. `npm run qa:agents`, `npm test`, `npm run lint`, `npm run build` and
   `git diff --check` PASS;
8. private evidence excluded from git and worktree clean.

## Current dependency gate

V3-10C3 is closed/certified. V3-10C4 product implementation must not begin
until a separate human-authorized C4 implementation prompt is provided.
