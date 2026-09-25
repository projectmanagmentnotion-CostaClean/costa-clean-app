# Metric Catalog — Dashboard Analytics V1

## Status vocabulary

- **VERIFIED**: current repository code demonstrates the formula and source semantics.
- **DERIVABLE / PRODUCT CONFIRMATION**: data exists and formula is technically deterministic, but the product has not yet established the business meaning as canonical.
- **UNVERIFIED**: repository evidence cannot justify the metric definition. Do not ship as a factual KPI.

All money is EUR under current `businessRules`. Business timezone is `Europe/Madrid`.

## M01 — FACTURADO_PERIODO

**Status:** VERIFIED current behavior / semantic decision still open  
**Business question:** ¿Qué total de factura pertenece al periodo por fecha de emisión?  
**Existing source:** `buildClosingDeterministicSummary`, `buildClosingSummary`, `useDashboardMetrics` for current month.  
**Data:** `invoices.issue_date`, `invoices.total`.  
**Formula:** sum `invoice.total` for invoices whose `issue_date` is inside the selected period.  
**Range:** selected analytical period.  
**Comparison:** previous equivalent period.  
**Format:** EUR.  
**Empty:** 0 € with “Sin facturas emitidas en este periodo.”  
**Edge cases:** invalid/missing dates excluded by date helper; decimals rounded at summary boundary.  
**Critical caveat:** current closing/dashboard period sums do not explicitly exclude cancelled invoices. Analytics V1 must not silently redefine this.  
**Confidence:** HIGH for current behavior; MEDIUM for desired business interpretation until cancellation treatment is approved.

## M02 — COBRADO_PERIODO

**Status:** VERIFIED  
**Business question:** ¿Cuánto dinero fue registrado como cobrado durante el periodo?  
**Existing source:** `buildClosingDeterministicSummary`, `buildClosingSummary`, `useDashboardMetrics`.  
**Data:** `payments.payment_date`, `payments.amount`.  
**Formula:** sum `payment.amount` for payments whose `payment_date` is inside the period.  
**Range:** selected period.  
**Comparison:** previous equivalent period.  
**Format:** EUR.  
**Empty:** 0 € / “Sin cobros registrados en este periodo.”  
**Edge cases:** payment origin does not change amount semantics; partial payments are valid.  
**Confidence:** HIGH.

## M03 — PENDIENTE_FACTURAS_PERIODO

**Status:** VERIFIED  
**Business question:** ¿Qué saldo sigue abierto hoy en facturas emitidas dentro del periodo?  
**Existing source:** deterministic closing summary.  
**Data:** `invoice.total`, optional `invoice.paid_amount`, payment rows grouped by `invoice_id`.  
**Formula per invoice:** `max(total - paidAmount, 0)`; include balance when > 0.009.  
**Range:** invoices selected by `issue_date` in period; payments used to determine current balance are not restricted to payment period.  
**Comparison:** previous issuance period is possible but must be labeled as current outstanding of those invoice cohorts.  
**Format:** EUR.  
**Empty:** 0 € / “No hay saldo pendiente en facturas de este periodo.”  
**Edge cases:** overpayment clamps to zero; partial payments supported; tolerance 0.009.  
**Confidence:** HIGH.

## M04 — PENDIENTE_GLOBAL_ACTUAL

**Status:** VERIFIED  
**Business question:** ¿Cuánto dinero total está pendiente hoy, sin limitar por fecha de emisión?  
**Existing source:** `useDashboardMetrics.outstandingReceivablesTotal`.  
**Data/formula:** visible, non-cancelled invoice outstanding using explicit outstanding when present, otherwise paid map fallback.  
**Range:** current snapshot, not period metric.  
**Comparison:** historical comparison is NOT valid without snapshot history.  
**Format:** EUR.  
**Empty:** 0 €.  
**Confidence:** HIGH.

## M05 — GASTOS_PERIODO

**Status:** VERIFIED current behavior / semantic decision still open  
**Business question:** ¿Qué total de gastos registrados pertenece al periodo?  
**Existing source:** closing summary engines.  
**Data:** expense fiscal year/quarter where present; otherwise `expense_date`; `expense.total`.  
**Formula:** sum period expense total.  
**Range:** selected period.  
**Comparison:** previous equivalent period.  
**Format:** EUR.  
**Empty:** 0 € / “Sin gastos registrados en este periodo.”  
**Critical caveat:** current period engine does not explicitly remove expenses whose payment/lifecycle state may be cancelled.  
**Confidence:** HIGH for current behavior; MEDIUM for desired cancellation treatment.

## M06 — ESTADO_FINANCIERO_FACTURA

**Status:** VERIFIED  
**Business question:** ¿Qué parte de las facturas está pendiente, parcialmente cobrada, cobrada o cancelada?  
**Existing source:** `buildInvoicePaymentSummary`.  
**States:** `pending | partially_paid | paid | cancelled`.  
**Formula:** cancelled from documentary state; otherwise outstanding <= 0.009 → paid; paid > 0.009 → partially paid; else pending.  
**Range:** invoice cohort chosen by selected period.  
**Aggregate formats:** count and total legal amount; optionally outstanding amount as secondary.  
**Empty:** no segments.  
**Confidence:** HIGH.

## M07 — CLIENTES_ACTIVOS_ACTUALES

**Status:** VERIFIED current Home semantics  
**Business question:** ¿Cuántos registros de cliente están activos actualmente?  
**Existing source:** `useDashboardMetrics`.  
**Formula:** exclude archived/deleted and `status === inactive`.  
**Range:** current snapshot only.  
**Comparison:** historical comparison unsupported without state history.  
**Format:** integer.  
**Confidence:** HIGH for current snapshot, LOW for historical “active clients” interpretation.

## M08 — SERVICIOS_COMPLETADOS_PERIODO

**Status:** VERIFIED domain semantics  
**Business question:** ¿Cuántos servicios con estado completado están fechados dentro del periodo?  
**Existing source:** jobs domain status contract and current dashboard completed-job logic.  
**Data:** `jobs.scheduled_date`, `jobs.status`, lifecycle fields.  
**Formula:** visible jobs with `status === completed` and period-matching scheduled date.  
**Range:** selected period.  
**Comparison:** previous period.  
**Format:** integer.  
**Confidence:** HIGH, provided the product accepts scheduled_date as the service period anchor.

## M09 — GASTOS_POR_CATEGORIA

**Status:** VERIFIED data taxonomy; aggregate follows M05  
**Business question:** ¿Dónde se concentra el gasto del periodo?  
**Data:** `expenses.category`, `expenses.total`.  
**Categories:** use canonical `expenseCategories` and `getExpenseCategoryLabel`.  
**Formula:** group M05 records by category and sum total.  
**Range:** selected period.  
**Format:** EUR + share percentage.  
**Edge cases:** unknown legacy category retained and humanized safely; no invented category.  
**Confidence:** HIGH, subject to M05 cancellation decision.

## M10 — CLIENTES_NUEVOS_PERIODO

**Status:** DERIVABLE / PRODUCT CONFIRMATION  
**Business question:** ¿Cuántos clientes fueron creados en el periodo?  
**Data:** `clients.created_at`, lifecycle/status fields.  
**Candidate formula:** visible client records whose `created_at` is inside the period.  
**Why not VERIFIED:** no existing canonical dashboard/business rule currently defines “cliente nuevo” for analytics, including whether converted leads/backfilled clients should use creation date or conversion date.  
**Confidence:** MEDIUM.

## M11 — TOP_CLIENTES_FACTURACION

**Status:** DERIVABLE / PRODUCT CONFIRMATION  
**Business question:** ¿Qué clientes concentran más facturación en el periodo?  
**Data:** M01 invoice cohort grouped by `client_id`, joined to clients for label.  
**Candidate formula:** sum invoice total by client; descending; show percentage of period invoiced total.  
**Dependency:** final M01 inclusion semantics.  
**Why not fully VERIFIED:** no existing canonical helper establishes this ranking/business interpretation.  
**Confidence:** MEDIUM-HIGH after M01 approval.

## M12 — RESULTADO_BENEFICIO

**Status:** UNVERIFIED  
**Business question:** ¿Cuál es el beneficio/resultado del negocio?  
**Source:** none canonical.  
**Do not use:** `facturado - gastos` or `cobrado - gastos` without explicit product/accounting definition.  
**Evidence gap:** closing engine reports invoiced, collected, expenses and missing payroll/hours; it does not calculate profit.  
**Confidence:** NONE until definition approved.

## M13 — FACTURAS_VENCIDAS

**Status:** UNVERIFIED  
**Business question:** ¿Qué facturas han superado su vencimiento?  
**Evidence gap:** invoice read/type contract exposes `issue_date`, not a canonical invoice due date.  
**Do not substitute:** “older than 7 days” alert. Age is not contractual maturity.  
**Confidence:** NONE.

## M14 — CRECIMIENTO_CLIENTES

**Status:** UNVERIFIED for historical active-base growth  
**Business question:** ¿Cómo crece la base activa de clientes?  
**Evidence gap:** current-state status exists, but no verified historical status/event timeline reconstructs active-client state by past date.  
**Safe alternative:** new-client creation counts if M10 is approved.  
**Confidence:** LOW.

## M15 — MARGEN

**Status:** UNVERIFIED  
**Business question:** ¿Qué margen genera el negocio o cada cliente/servicio?  
**Evidence gap:** no canonical allocation of expenses/payroll/hours to invoice/client/service and no real payroll/hours module in the audited engine.  
**Confidence:** NONE.

## Proposed V1 metric gate

### Ready to implement after two semantics are confirmed

- M01 Facturado.
- M02 Cobrado.
- M03 Pendiente del periodo.
- M05 Gastos.
- M06 Invoice financial state.
- M09 Expenses by category.

### Safe current snapshot/support

- M04 Pending global current.
- M07 Active clients current.
- M08 Completed services by period.

### Requires product confirmation before implementation

- M10 New clients.
- M11 Top clients.

### Blocked from factual UI

- M12 Result/benefit.
- M13 Overdue invoices.
- M14 historical active-client growth.
- M15 Margin.
