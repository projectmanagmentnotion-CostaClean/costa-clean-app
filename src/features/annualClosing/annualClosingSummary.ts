import type { AnnualClosingSnapshot, AnnualClosingSummary } from './types'
import type { QuarterlyClosingSummary } from '../quarterlyClosing/types'

function buildQuarterlyBreakdown(
  quarterlySummaryByPeriod: Map<string, QuarterlyClosingSummary>,
  fiscalYear: number,
) {
  return [1, 2, 3, 4].map((fiscalQuarter) => {
    const quarterlySummary = quarterlySummaryByPeriod.get(`${fiscalYear}-Q${fiscalQuarter}`) ?? {
      fiscalYear,
      fiscalQuarter,
      invoiceCount: 0,
      paymentCount: 0,
      expenseCount: 0,
      closureExpenseCount: 0,
      missingSupportCount: 0,
      pendingReviewCount: 0,
      riskCount: 0,
      fiscalReviewCount: 0,
      fiscalRiskCount: 0,
      missingValidVatInvoiceCount: 0,
      pendingInvoiceCount: 0,
      unresolvedIncidenceCount: 0,
      invoicedTotal: 0,
      collectedTotal: 0,
      outstandingTotal: 0,
      expensesTotal: 0,
      estimatedDeductibleBase: 0,
      estimatedDeductibleVat: 0,
      totalVatSupported: 0,
      incidences: [],
      readiness: 'ready' as const,
    }

    return {
      fiscal_quarter: fiscalQuarter,
      invoiced_total: quarterlySummary.invoicedTotal,
      collected_total: quarterlySummary.collectedTotal,
      outstanding_total: quarterlySummary.outstandingTotal,
      expenses_total: quarterlySummary.expensesTotal,
      unresolved_incidence_count: quarterlySummary.unresolvedIncidenceCount,
      quarterlySummary,
    }
  })
}

export function buildAnnualClosingSummary(
  quarterlySummaryByPeriod: Map<string, QuarterlyClosingSummary>,
  fiscalYear: number,
): AnnualClosingSummary {
  const quarterlyBreakdown = buildQuarterlyBreakdown(quarterlySummaryByPeriod, fiscalYear)

  const invoiceCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.invoiceCount, 0)
  const paymentCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.paymentCount, 0)
  const expenseCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.expenseCount, 0)
  const closureExpenseCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.closureExpenseCount, 0)
  const missingSupportCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.missingSupportCount, 0)
  const pendingReviewCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.pendingReviewCount, 0)
  const riskCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.riskCount, 0)
  const fiscalReviewCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.fiscalReviewCount, 0)
  const fiscalRiskCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.fiscalRiskCount, 0)
  const missingValidVatInvoiceCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.missingValidVatInvoiceCount, 0)
  const pendingInvoiceCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.pendingInvoiceCount, 0)
  const unresolvedIncidenceCount = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.unresolvedIncidenceCount, 0)
  const invoicedTotal = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.invoicedTotal, 0)
  const collectedTotal = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.collectedTotal, 0)
  const outstandingTotal = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.outstandingTotal, 0)
  const expensesTotal = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.expensesTotal, 0)
  const estimatedDeductibleBase = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.estimatedDeductibleBase, 0)
  const estimatedDeductibleVat = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.estimatedDeductibleVat, 0)
  const totalVatSupported = quarterlyBreakdown.reduce((sum, quarter) => sum + quarter.quarterlySummary.totalVatSupported, 0)

  return {
    fiscalYear,
    invoiceCount,
    paymentCount,
    expenseCount,
    closureExpenseCount,
    missingSupportCount,
    pendingReviewCount,
    riskCount,
    fiscalReviewCount,
    fiscalRiskCount,
    missingValidVatInvoiceCount,
    pendingInvoiceCount,
    unresolvedIncidenceCount,
    invoicedTotal,
    collectedTotal,
    outstandingTotal,
    expensesTotal,
    estimatedDeductibleBase,
    estimatedDeductibleVat,
    totalVatSupported,
    readiness:
      missingSupportCount > 0 ||
      pendingReviewCount > 0 ||
      riskCount > 0 ||
      fiscalReviewCount > 0 ||
      fiscalRiskCount > 0 ||
      missingValidVatInvoiceCount > 0 ||
      pendingInvoiceCount > 0
        ? 'issues'
        : 'ready',
    quarterlyBreakdown,
    incidences: [
      {
        id: 'invoice_year_all',
        label: 'Facturas emitidas del año',
        detail: 'Base anual consolidada para el cierre.',
        count: invoiceCount,
        tone: 'neutral',
        view: 'invoices',
        scope: 'invoice_year_all',
      },
      {
        id: 'payment_year_all',
        label: 'Cobros registrados del año',
        detail: 'Cobros con fecha dentro del ejercicio seleccionado.',
        count: paymentCount,
        tone: 'neutral',
        view: 'payments',
        scope: 'payment_year_all',
      },
      {
        id: 'expense_year_closure',
        label: 'Gastos que afectan al cierre anual',
        detail: 'Registros marcados como relevantes para el cierre del ejercicio.',
        count: closureExpenseCount,
        tone: 'neutral',
        view: 'expenses',
        scope: 'expense_year_closure',
      },
      {
        id: 'invoice_year_pending',
        label: 'Pendiente de cobro del año',
        detail: 'Facturas emitidas en el ejercicio que siguen con saldo pendiente.',
        count: pendingInvoiceCount,
        tone: pendingInvoiceCount > 0 ? 'warning' : 'neutral',
        view: 'invoices',
        scope: 'invoice_year_pending',
      },
      {
        id: 'expense_year_missing_support',
        label: 'Gastos sin justificante',
        detail: 'Incidencias documentales todavía abiertas en el ejercicio.',
        count: missingSupportCount,
        tone: missingSupportCount > 0 ? 'danger' : 'neutral',
        view: 'expenses',
        scope: 'expense_year_missing_support',
      },
      {
        id: 'expense_year_pending_review',
        label: 'Gastos pendientes de revisión',
        detail: 'Gastos del ejercicio pendientes de validación fiscal.',
        count: pendingReviewCount,
        tone: pendingReviewCount > 0 ? 'warning' : 'neutral',
        view: 'expenses',
        scope: 'expense_year_pending_review',
      },
      {
        id: 'expense_year_risk',
        label: 'Gastos con riesgo medio/alto',
        detail: 'Registros con señal de riesgo para revisión previa al cierre.',
        count: riskCount,
        tone: riskCount > 0 ? 'warning' : 'neutral',
        view: 'expenses',
        scope: 'expense_year_risk',
      },
    ],
  }
}

export function buildAnnualClosingSnapshot(summary: AnnualClosingSummary): AnnualClosingSnapshot {
  return {
    fiscal_year: summary.fiscalYear,
    generated_at: new Date().toISOString(),
    metrics: {
      invoice_count: summary.invoiceCount,
      payment_count: summary.paymentCount,
      expense_count: summary.expenseCount,
      closure_expense_count: summary.closureExpenseCount,
      missing_support_count: summary.missingSupportCount,
      pending_review_count: summary.pendingReviewCount,
      risk_count: summary.riskCount,
      fiscal_review_count: summary.fiscalReviewCount,
      fiscal_risk_count: summary.fiscalRiskCount,
      missing_valid_vat_invoice_count: summary.missingValidVatInvoiceCount,
      pending_invoice_count: summary.pendingInvoiceCount,
      unresolved_incidence_count: summary.unresolvedIncidenceCount,
      invoiced_total: summary.invoicedTotal,
      collected_total: summary.collectedTotal,
      outstanding_total: summary.outstandingTotal,
      expenses_total: summary.expensesTotal,
      estimated_deductible_base: summary.estimatedDeductibleBase,
      estimated_deductible_vat: summary.estimatedDeductibleVat,
      total_vat_supported: summary.totalVatSupported,
      quarterly_breakdown: summary.quarterlyBreakdown.map((quarter) => ({
        fiscal_quarter: quarter.fiscal_quarter,
        invoiced_total: quarter.invoiced_total,
        collected_total: quarter.collected_total,
        outstanding_total: quarter.outstanding_total,
        expenses_total: quarter.expenses_total,
        unresolved_incidence_count: quarter.unresolved_incidence_count,
      })),
    },
  }
}
