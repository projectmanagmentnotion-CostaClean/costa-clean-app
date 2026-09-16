# V3-10C4.1 — SHARED FINANCE HIERARCHY

Status: `CLOSED / CERTIFIED`

Starting HEAD: `c06cf346af1fcd5338ee36d6fd9e1b0f8b79dae8`

## Scope completed

C4.1 refines the shared finance presentation layer across Invoices, Quotes,
Payments and Expenses. It does not start the module-specific C4.2–C4.6 work.

- Added `V3ActionGroup` to express a coherent header/workspace action group
  without replacing existing action callbacks.
- Added the `supporting` variant of `V3KpiGroup` and used it for finance
  summaries.
- Moved search/filter controls before KPI summaries in all four lists.
- Added the finance-specific mobile action layout: one full-width primary
  action, followed by compact secondary actions.
- Added a supporting-summary mobile layout that keeps finance KPI reading
  compact while retaining 44px controls.
- Normalized finance list empty/error rendering through `V3EmptyState` and
  `V3ErrorState`.

## Protected behavior

No business API, RPC, storage, document, totals/IVA, duplicate, settlement or
conversion implementation changed. In particular, C4.1 did not modify:

- `canSettleInvoiceByTransfer`, `settleInvoiceByTransfer` or
  `settle_invoice_by_transfer`;
- `acceptQuoteWorkflow` or `accept_quote_workflow`;
- `savePaymentAndRefreshInvoice`, `PaymentCreateFlow` or payment origin data;
- expense create/edit persistence, private signed URLs or the 10 MB rule;
- PDF/export behavior.

## Authenticated read-only QA

QA used the canonical `costaclean-v3` profile at
`http://127.0.0.1:4178/?v3=1`, with no business actions, forms, document
operations or mutations.

| Surface | 390x844 | 768x1024 | 1440x900 |
| --- | --- | --- | --- |
| Invoices list | PASS | PASS | PASS |
| Quotes list | PASS | PASS | PASS |
| Payments list | PASS | PASS | PASS |
| Expenses list | PASS | PASS | PASS |
| Invoice Workspace | N/A | PASS | N/A |

For every inspected list/viewport combination: controls precede the supporting
summary; the header contains one primary action; horizontal overflow, visible
UUIDs, Unicode-as-icon, legacy/V2 text, broken assets and visible undersized
controls were all `0`. The available Invoice Workspace had one primary top
action and no horizontal overflow. Quotes, Payments and Expenses workspaces
were unavailable or deliberately not opened in this read-only C4.1 review.

Back navigation and filter-sheet Escape were verified on Invoice Workspace;
when the trigger holds focus before opening, focus returns to the filter
trigger on Escape. QA session persistence after reload was preserved.

Private QA screenshots are ignored and excluded from source control.

## Regression coverage

- `src/v3/financeSharedHierarchy.test.ts` verifies the shared action group,
  supporting KPI order, mobile geometry hooks and common state primitives.
- Existing Invoice, Quote and Payment V3 tests continue to cover the relevant
  real actions and human-readable labels.

## Validation

The C4.1 closeout runs the full suite, project agent validator, lint, build and
`git diff --check`. C4.2–C4.6 remain not started.
