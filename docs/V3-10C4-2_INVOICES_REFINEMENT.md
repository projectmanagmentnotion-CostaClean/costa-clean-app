# V3-10C4.2 — Invoices refinement

Status: `CLOSED / CERTIFIED`

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

## Validation and authenticated evidence

- focused Invoice, selection and settlement tests passed (`18` tests);
- lint, build and `git diff --check` passed after the implementation;
- final read-only authenticated replay passed at `390x844`, `768x1024` and
  `1440x900` after the mobile action grouping.

At every certified viewport the replay verified the list, filter sheet and
Escape/focus restoration, workspace, financial hierarchy, one settlement CTA,
settlement confirmation copy without confirmation submission, PDF and
`Más acciones`/document affordances, deep link, hard reload and Back.

The runtime recorder found zero production requests, production mutations, QA
mutations, console errors, page errors, horizontal overflow, undersized action
targets, clipped financial values, visible or accessible UUIDs, Unicode icon
content, legacy markers and broken images. A blank `Document` abort emitted by
CDP during a target replacement on two viewport runs had no URL, was followed
by a successful loaded workspace/reload/Back sequence, and was classified as a
harness navigation event rather than a failed critical application request.

**V3-10C4.2 is CLOSED / CERTIFIED.** C4 remains open; C4.3–C4.6 and C5 remain
not started.
