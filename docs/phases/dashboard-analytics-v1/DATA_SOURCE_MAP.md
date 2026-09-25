# Data Source Map — Dashboard Analytics V1

## Rule

Every visible metric must have one traceable path:

```
UI metric
  ↓
analytics selector / series builder
  ↓
existing domain rule
  ↓
existing read path
  ↓
Supabase table / field
```

The future implementation must keep chart components free of direct Supabase queries.

## M01 Facturado del periodo

```
Analytics KPI / temporal series
  ↓
analytics.selectInvoiced(period)
  ↓
existing buildClosingSummary / buildClosingDeterministicSummary semantics
  ↓
listInvoices() in src/app/appDataApi.ts
  ↓
public.invoices
    issue_date
    total
    status/lifecycle fields
    client_id
```

Open decision: cancelled-invoice inclusion.

## M02 Cobrado del periodo

```
Analytics KPI / temporal series
  ↓
analytics.selectCollected(period)
  ↓
existing closing summary semantics
  ↓
listPayments()
  ↓
public.payments
    payment_date
    amount
    invoice_id
    payment_method
    origin_type
```

## M03 Pendiente de facturas del periodo

```
Analytics KPI / invoice status section
  ↓
analytics.selectOutstandingForInvoiceCohort(period)
  ↓
buildClosingDeterministicSummary
  + buildInvoicePaymentSummary / settlement tolerance
  ↓
listInvoices() + listPayments()
  ↓
public.invoices
    id, issue_date, total, status
  +
public.payments
    invoice_id, amount, payment_date
```

Important: payment history is used to calculate current remaining balance even when a payment occurs after the invoice cohort period.

## M04 Pendiente global actual

```
Current snapshot KPI
  ↓
analytics.selectCurrentOutstanding()
  ↓
useDashboardMetrics.outstandingReceivablesTotal semantics
  ↓
listInvoices() + listPayments()
  ↓
invoices + payments
```

This metric is not period-comparable without historical snapshots.

## M05 Gastos del periodo

```
Analytics KPI / temporal series
  ↓
analytics.selectExpenses(period)
  ↓
closing engine expense-period selection
  ↓
listExpenses() in expenseApi.ts
  ↓
public.expenses
    expense_date
    fiscal_year
    fiscal_quarter
    total
    category
    payment_status
```

Open decision: cancelled-expense inclusion.

## M06 Estado financiero de facturas

```
Invoice state visualization
  ↓
analytics.groupInvoiceFinancialStates(period)
  ↓
buildInvoicePaymentSummary()
  ↓
invoice cohort + payments grouped by invoice_id
  ↓
invoices + payments
```

States: pending / partially_paid / paid / cancelled.

## M07 Clientes activos actuales

```
Snapshot KPI
  ↓
analytics.selectCurrentActiveClients()
  ↓
useDashboardMetrics visibleClients semantics
  ↓
listClients()
  ↓
public.clients
    status
    archived_at
    deleted_at
```

No historical active-series claim.

## M08 Servicios completados del periodo

```
Secondary KPI / temporal series
  ↓
analytics.selectCompletedJobs(period)
  ↓
job operational status semantics
  ↓
listJobs()
  ↓
public.jobs
    scheduled_date
    status
    cancelled_at
    archived_at
    deleted_at
    client_id
    service_type
```

## M09 Gastos por categoría

```
Expense category chart
  ↓
analytics.groupExpensesByCategory(period)
  ↓
M05 expense cohort + getExpenseCategoryLabel()
  ↓
listExpenses()
  ↓
public.expenses
    category
    total
```

Canonical taxonomy lives in `src/features/expenses/types.ts`.

## M10 Clientes nuevos del periodo

```
Candidate secondary metric
  ↓
analytics.selectNewClients(period)
  ↓
PRODUCT DEFINITION PENDING
  ↓
listClients()
  ↓
public.clients
    created_at
    status/lifecycle
    source_lead_id
```

No implementation until creation-vs-conversion semantics are accepted.

## M11 Top clientes por facturación

```
Client ranking
  ↓
analytics.rankClientsByInvoiced(period)
  ↓
M01 invoice inclusion semantics
  ↓
listInvoices() + listClients()
  ↓
invoices.client_id, invoices.total
clients.id, clients.full_name/display_code
```

No raw UUID fallback in UI.

## M12 Resultado / beneficio

```
BLOCKED
  ↓
no canonical analytics function
  ↓
no accepted domain rule
  ↓
insufficient source model
```

The closing engine explicitly knows invoices, payments and expenses but flags absent payroll/hours. Do not fabricate a source.

## M13 Facturas vencidas

```
BLOCKED
  ↓
no canonical due-date rule
  ↓
invoice read contract lacks invoice due date
```

Do not map the existing “older than 7 days” issue-date alert to overdue.

## Proposed analytics adapter boundary

Initial implementation should consume the same authenticated arrays already loaded by `useAppData`:

```
useAppData
  ↓
DashboardAnalyticsInput
  ↓
pure selectors / period normalization / comparisons
  ↓
DashboardAnalyticsModel
  ↓
V3 Home analytics components
```

Benefits:

- zero new RLS surface;
- zero service-role use;
- no per-chart requests;
- easy unit testing;
- semantic reuse.

## Performance evolution path

If profiling shows full-array loading is too expensive:

```
DashboardAnalyticsInput interface
  ↑
existing-array adapter     analytics-range-query adapter
                                  ↓
                        existing Supabase REST/RLS
```

Only after profiling should the team consider:

- range-specific projections;
- PostgREST aggregate/RPC approach;
- database view;
- indexes.

The UI/metric contracts should not change when the adapter changes.
