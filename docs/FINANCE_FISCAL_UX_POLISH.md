# Finance / Fiscal UX Polish

## Scope

Sprint 11 applies safe UX polish to the live finance workspace only:

- `src/pages/PaymentsPage.tsx`
- `src/features/payments/PaymentsList.tsx`
- `src/features/payments/PaymentDetailCard.tsx`
- `src/pages/ExpensesPage.tsx`
- `src/features/expenses/ExpensesList.tsx`
- `src/features/expenses/ExpenseDetailCard.tsx`
- `src/pages/FiscalClosingPage.tsx`

No fiscal logic, persistence, numbering, SQL, RPC, routes, auth, or Supabase contracts were changed.

## Previous State Summary

- Payments already behaved as an auxiliary workspace, but its list and detail surfaces still used ad hoc section headers and generic empty/error states.
- Expenses already had strong fiscal signals, but the list/detail pair still felt denser than necessary and did not reuse the newer DS state primitives.
- Fiscal closing contained the right information, but the first decision layer was diluted by secondary labels and less explicit action framing.

## UX Changes Applied

### Payments

- Standardized the list and detail headers with DS section headers.
- Replaced ad hoc empty/error blocks with `DSEmptyState` and `DSErrorState`.
- Kept the module clearly subordinate to invoices in the copy so it does not compete with the invoice workspace.

### Expenses

- Standardized the list and detail headers with DS section headers.
- Replaced ad hoc empty/error blocks with DS state primitives.
- Clarified that the base detail card is for review first, while support, fiscal review, and edit stay in separate surfaces.

### Fiscal Closing

- Standardized the top error state with `DSErrorState`.
- Reframed the first block as a decision surface instead of a metrics wall.
- Renamed secondary sections so checklist, warnings, and snapshot context read in a clearer order.

## Decisions Taken

- StepFlow migration for finance surfaces is postponed in Sprint 11.
- `PaymentCreateFlow`, `ExpenseCreateFlow`, `ExpenseEditFlow`, and closing/export overlays remain as they are.
- The safe win in this sprint is hierarchy, copy, density, and state consistency, not orchestration replacement.

## What Was Explicitly Not Touched

- `src/features/financial/financialWriteApi.ts`
- invoice numbering
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- VAT/fiscal calculations
- quarterly/annual closing calculations
- persistence flows
- routes and `?view=`
- Supabase, SQL, RPC, migrations, auth

## Remaining Risks

- Payments still write through a sensitive financial path and should not be re-orchestrated casually.
- Expenses still carry support, fiscal review, and AI-assisted reading inside the same domain, even if the visual hierarchy is clearer now.
- Fiscal closing still depends on deterministic summaries plus assisted intelligence, so wording must stay cautious and non-definitive.

## Recommended Next Step

- Sprint 12 should standardize loading, saving, success, confirmation, and error behavior across these finance surfaces without changing business logic.

## Update 2026-07-08

- `FiscalClosingPage` deja de competir con varias metricas primarias en el primer viewport.
- El foco pasa a `Importe real del segundo semestre` con CTA directa a facturas incluidas.
- `Base imponible`, `IVA`, `Facturas emitidas`, `Cobrado` y `Pendiente` se mueven a un bloque plegado `Desglose real`.
- El motor alternativo de mes, trimestre, anio y rango personalizado queda fuera del flujo principal bajo `Motor fiscal completo`.
- Se anade una auditoria determinista especifica del segundo semestre en `src/features/closing/fiscalSemesterAudit.ts`.
