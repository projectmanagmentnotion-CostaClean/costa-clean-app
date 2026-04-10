import type { ExpenseListItem } from '../expenses/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { QuarterlyClosingSnapshot, QuarterlyClosingSummary } from './types'

function parseDate(dateValue: string): Date | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function matchesDateQuarter(dateValue: string, fiscalYear: number, fiscalQuarter: number): boolean {
  const date = parseDate(dateValue)
  if (!date) return false
  return date.getFullYear() === fiscalYear && Math.floor(date.getMonth() / 3) + 1 === fiscalQuarter
}

function matchesExpenseQuarter(expense: ExpenseListItem, fiscalYear: number, fiscalQuarter: number): boolean {
  if (expense.fiscal_year && expense.fiscal_quarter) {
    return expense.fiscal_year === fiscalYear && expense.fiscal_quarter === fiscalQuarter
  }

  return matchesDateQuarter(expense.expense_date, fiscalYear, fiscalQuarter)
}

export function buildQuarterlyClosingSummary(
  invoices: InvoiceListItem[],
  payments: PaymentListItem[],
  expenses: ExpenseListItem[],
  fiscalYear: number,
  fiscalQuarter: number,
): QuarterlyClosingSummary {
  const quarterInvoices = invoices.filter((invoice) =>
    matchesDateQuarter(invoice.issue_date, fiscalYear, fiscalQuarter),
  )
  const quarterPayments = payments.filter((payment) =>
    matchesDateQuarter(payment.payment_date, fiscalYear, fiscalQuarter),
  )
  const quarterExpenses = expenses.filter((expense) =>
    matchesExpenseQuarter(expense, fiscalYear, fiscalQuarter),
  )
  const quarterClosureExpenses = quarterExpenses.filter((expense) => expense.affects_quarterly_closure)
  const missingSupportExpenses = quarterClosureExpenses.filter(
    (expense) =>
      expense.document_support_status === 'missing' ||
      (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid'),
  )
  const pendingReviewExpenses = quarterClosureExpenses.filter(
    (expense) => expense.fiscal_review_status === 'pending',
  )
  const riskExpenses = quarterClosureExpenses.filter(
    (expense) => expense.fiscal_risk_level === 'medium' || expense.fiscal_risk_level === 'high',
  )

  const paidAmountByInvoiceId = new Map<string, number>()
  for (const payment of payments) {
    const currentPaid = paidAmountByInvoiceId.get(payment.invoice_id) ?? 0
    paidAmountByInvoiceId.set(payment.invoice_id, currentPaid + Number(payment.amount || 0))
  }

  const pendingQuarterInvoices = quarterInvoices.filter((invoice) => {
    const invoiceTotal = Number(invoice.total || 0)
    const paidAmount = paidAmountByInvoiceId.get(invoice.id) ?? 0
    return Math.max(invoiceTotal - paidAmount, 0) > 0.009
  })

  const summary: QuarterlyClosingSummary = {
    fiscalYear,
    fiscalQuarter,
    invoiceCount: quarterInvoices.length,
    paymentCount: quarterPayments.length,
    expenseCount: quarterExpenses.length,
    closureExpenseCount: quarterClosureExpenses.length,
    missingSupportCount: missingSupportExpenses.length,
    pendingReviewCount: pendingReviewExpenses.length,
    riskCount: riskExpenses.length,
    pendingInvoiceCount: pendingQuarterInvoices.length,
    unresolvedIncidenceCount:
      missingSupportExpenses.length +
      pendingReviewExpenses.length +
      riskExpenses.length +
      pendingQuarterInvoices.length,
    invoicedTotal: quarterInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    collectedTotal: quarterPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    outstandingTotal: pendingQuarterInvoices.reduce((sum, invoice) => {
      const invoiceTotal = Number(invoice.total || 0)
      const paidAmount = paidAmountByInvoiceId.get(invoice.id) ?? 0
      return sum + Math.max(invoiceTotal - paidAmount, 0)
    }, 0),
    expensesTotal: quarterExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0),
    readiness:
      missingSupportExpenses.length > 0 ||
      pendingReviewExpenses.length > 0 ||
      riskExpenses.length > 0 ||
      pendingQuarterInvoices.length > 0
        ? 'issues'
        : 'ready',
    incidences: [
      {
        id: 'invoice_quarter_all',
        label: 'Facturas emitidas',
        detail: 'Base del trimestre para el cierre operativo.',
        count: quarterInvoices.length,
        tone: 'neutral',
        view: 'invoices',
        scope: 'invoice_quarter_all',
      },
      {
        id: 'payment_quarter_all',
        label: 'Cobros registrados',
        detail: 'Movimientos cobrados dentro del trimestre.',
        count: quarterPayments.length,
        tone: 'neutral',
        view: 'payments',
        scope: 'payment_quarter_all',
      },
      {
        id: 'expense_quarter_closure',
        label: 'Gastos que afectan al cierre',
        detail: 'Registros marcados para cierre trimestral.',
        count: quarterClosureExpenses.length,
        tone: 'neutral',
        view: 'expenses',
        scope: 'expense_quarter_closure',
      },
      {
        id: 'invoice_quarter_pending',
        label: 'Pendiente de cobro',
        detail: 'Facturas del trimestre con saldo pendiente hoy.',
        count: pendingQuarterInvoices.length,
        tone: pendingQuarterInvoices.length > 0 ? 'warning' : 'neutral',
        view: 'invoices',
        scope: 'invoice_quarter_pending',
      },
      {
        id: 'expense_quarter_missing_support',
        label: 'Gastos sin justificante',
        detail: 'Incidencias documentales que bloquean el cierre.',
        count: missingSupportExpenses.length,
        tone: missingSupportExpenses.length > 0 ? 'danger' : 'neutral',
        view: 'expenses',
        scope: 'expense_quarter_missing_support',
      },
      {
        id: 'expense_quarter_pending_review',
        label: 'Gastos pendientes de revisión',
        detail: 'Gastos del trimestre pendientes de validación fiscal.',
        count: pendingReviewExpenses.length,
        tone: pendingReviewExpenses.length > 0 ? 'warning' : 'neutral',
        view: 'expenses',
        scope: 'expense_quarter_pending_review',
      },
      {
        id: 'expense_quarter_risk',
        label: 'Gastos con riesgo medio/alto',
        detail: 'Registros con señal fiscal a revisar antes de cerrar.',
        count: riskExpenses.length,
        tone: riskExpenses.length > 0 ? 'warning' : 'neutral',
        view: 'expenses',
        scope: 'expense_quarter_risk',
      },
    ],
  }

  return summary
}

export function buildQuarterlyClosingSnapshot(summary: QuarterlyClosingSummary): QuarterlyClosingSnapshot {
  return {
    fiscal_year: summary.fiscalYear,
    fiscal_quarter: summary.fiscalQuarter,
    generated_at: new Date().toISOString(),
    metrics: {
      invoice_count: summary.invoiceCount,
      payment_count: summary.paymentCount,
      expense_count: summary.expenseCount,
      closure_expense_count: summary.closureExpenseCount,
      missing_support_count: summary.missingSupportCount,
      pending_review_count: summary.pendingReviewCount,
      risk_count: summary.riskCount,
      pending_invoice_count: summary.pendingInvoiceCount,
      unresolved_incidence_count: summary.unresolvedIncidenceCount,
      invoiced_total: summary.invoicedTotal,
      collected_total: summary.collectedTotal,
      outstanding_total: summary.outstandingTotal,
      expenses_total: summary.expensesTotal,
    },
  }
}
