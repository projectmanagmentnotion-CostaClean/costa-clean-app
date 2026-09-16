# V3-10C4.2 — Invoices refinement

Status: `IMPLEMENTED / AUTHENTICATED REPLAY PENDING`

Starting HEAD: `57bb8b2`

## Scope and boundary

This slice refines only the V3 Invoice list, Invoice Workspace and the
invoice-specific selection confirmation label. It does not begin Quotes,
Payments, Expenses, cross-finance certification or Operations work.

No Supabase schema, policy, RPC, storage or business data was changed. No
production request or deployment was made.

## Findings addressed

- **F-C4-P1-002 — settlement clarity:** eligible invoices use `Registrar
  cobro`, and the confirmation explains the exact transfer against the
  outstanding balance, total and amount already paid before any action can be
  confirmed.
- **F-C4-P2-002 — invoice scan order:** list rows show total plus a concise
  paid/outstanding line without recalculating a financial amount.
- **F-C4-P2-003 — workspace composition:** the workspace makes invoice
  identity, status and financial facts distinct, retains a single settlement
  primary action, keeps PDF directly available, and groups edit/document
  actions under `Más acciones`.

## Protected contracts

The following were used only as existing read-only presentation inputs or
callbacks and were not changed:

- `canSettleInvoiceByTransfer`
- `settleInvoiceByTransfer`
- `settle_invoice_by_transfer`
- invoice totals, IVA, numbering, lifecycle and duplicate protections
- invoice-to-payment relationship and selection export callbacks
- existing invoice PDF/document engine and permissions

The UI never writes a paid state directly. A settlement can only continue
through the pre-existing guarded callback after the user explicitly confirms.
Partial settlement remains represented by the existing outstanding amount.

## Accessibility and responsive contracts

- Existing shared actions retain the C1 `44px` minimum target contract.
- Financial values use labelled definition-list semantics in the workspace.
- Both settlement and `Más acciones` use the existing focus-restoring,
  Escape-dismissible confirmation/sheet primitives.
- No Unicode pictogram, raw UUID or legacy V2 presentation dependency was
  introduced.

Private visual evidence is ignored and never committed.

## Validation completed

- focused Invoice, selection and settlement tests passed (`18` tests);
- lint, build and `git diff --check` passed after the implementation;
- read-only authenticated evidence before the final mobile action-group
  refinement covered invoice list/filter/workspace, confirmation without
  submission, deep-link reload and Back at `390x844`, `768x1024` and
  `1440x900`, with no QA mutations or production requests.

## Required before certification

The local QA browser sessions now render Login after reload. The session was
not altered. A user-authenticated, read-only post-change replay remains
required at `390x844`, `768x1024` and `1440x900` for:

1. list, search and filter;
2. workspace totals/status and the settlement confirmation copy without
   confirming it;
3. `Más acciones`, PDF/document affordances, Escape/focus restoration;
4. deep link, hard reload and Back;
5. overflow, UUID, Unicode, legacy, console/page-error, production-request and
   QA-mutation checks.

Until this exact replay passes, **V3-10C4.2 is not certified**. C4 remains
open; C4.3–C4.6 and C5 remain not started.
