import type { AnnualClosingSummary } from '../annualClosing/types'
import type { ExpenseListItem } from '../expenses/types'
import { buildFiscalVatSummary } from './fiscalVatSummary'
import { hasMediumHighFiscalRisk, needsFiscalReview } from '../expenses/fiscalIntelligenceSummary'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import type { QuoteListItem } from '../quotes/types'
import type { QuarterlyClosingSummary } from '../quarterlyClosing/types'
import {
  isDateWithinFiscalPeriod,
  resolveFiscalPeriod,
  type FiscalPeriodSelection,
  type ResolvedFiscalPeriod,
} from './fiscalPeriods'

export type ClosingIncidenceTone = 'neutral' | 'warning' | 'danger'
export type ClosingIncidenceView = 'invoices' | 'payments' | 'expenses'
export type ClosingIncidenceScope = 'all' | 'pending' | 'closure' | 'missing_support' | 'pending_review' | 'risk'
export type ClosingSnapshotMode = 'quarterly' | 'annual' | null

export interface ClosingSummaryIncidence {
  id: string
  label: string
  detail: string
  count: number
  tone: ClosingIncidenceTone
  view: ClosingIncidenceView
  scope: ClosingIncidenceScope
}

export interface ClosingQuarterBreakdownItem {
  fiscalQuarter: number
  invoicedTotal: number
  collectedTotal: number
  outstandingTotal: number
  expensesTotal: number
  outputVatTotal: number
  estimatedDeductibleVat: number
  estimatedNetVatPayable: number
  unresolvedIncidenceCount: number
}

export interface ClosingSummary {
  period: ResolvedFiscalPeriod
  snapshotMode: ClosingSnapshotMode
  fiscalYear: number
  fiscalQuarter: number | null
  invoiceCount: number
  paymentCount: number
  expenseCount: number
  closureExpenseCount: number
  missingSupportCount: number
  pendingReviewCount: number
  riskCount: number
  fiscalReviewCount: number
  fiscalRiskCount: number
  missingValidVatInvoiceCount: number
  pendingInvoiceCount: number
  unresolvedIncidenceCount: number
  invoicedTotal: number
  collectedTotal: number
  outstandingTotal: number
  expensesTotal: number
  outputVatTotal: number
  estimatedDeductibleBase: number
  estimatedDeductibleVat: number
  totalVatSupported: number
  estimatedNetVatPayable: number
  readiness: 'ready' | 'issues'
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  closureExpenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  pendingInvoices: InvoiceListItem[]
  missingSupportExpenses: ExpenseListItem[]
  pendingReviewExpenses: ExpenseListItem[]
  riskExpenses: ExpenseListItem[]
  incidences: ClosingSummaryIncidence[]
  quarterBreakdown: ClosingQuarterBreakdownItem[]
}

interface BuildClosingSummaryInput {
  selection: FiscalPeriodSelection
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  quarterlySummaryByPeriod: Map<string, QuarterlyClosingSummary>
  annualSummaryByYear: Map<number, AnnualClosingSummary>
}

function getQuarterFromDate(dateValue: string): number | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(date.getMonth() / 3) + 1
}

function isExpenseWithinPeriod(expense: ExpenseListItem, period: ResolvedFiscalPeriod): boolean {
  if (period.mode === 'quarter') {
    const periodQuarter = Math.floor((Number(period.startDate.slice(5, 7)) - 1) / 3) + 1
    const quarter = getQuarterFromDate(expense.expense_date)
    if (expense.fiscal_year && expense.fiscal_quarter) {
      return expense.fiscal_year === period.year && expense.fiscal_quarter === periodQuarter
    }
    return period.year === Number(period.startDate.slice(0, 4)) && quarter === periodQuarter
  }

  if (period.mode === 'year') {
    if (expense.fiscal_year) return expense.fiscal_year === period.year
  }

  return isDateWithinFiscalPeriod(expense.expense_date, period)
}

function getClosurePredicate(period: ResolvedFiscalPeriod) {
  if (period.mode === 'quarter') {
    return (expense: ExpenseListItem) => expense.affects_quarterly_closure
  }

  if (period.mode === 'year') {
    return (expense: ExpenseListItem) => expense.affects_annual_closure
  }

  return (expense: ExpenseListItem) => expense.affects_quarterly_closure || expense.affects_annual_closure
}

function buildQuarterBreakdown(summary: AnnualClosingSummary | undefined): ClosingQuarterBreakdownItem[] {
  if (!summary) return []

  return summary.quarterlyBreakdown.map((quarter) => ({
    fiscalQuarter: quarter.fiscal_quarter,
    invoicedTotal: quarter.invoiced_total,
    collectedTotal: quarter.collected_total,
    outstandingTotal: quarter.outstanding_total,
    expensesTotal: quarter.expenses_total,
    outputVatTotal: quarter.output_vat_total,
    estimatedDeductibleVat: quarter.estimated_deductible_vat,
    estimatedNetVatPayable: quarter.estimated_net_vat_payable,
    unresolvedIncidenceCount: quarter.unresolved_incidence_count,
  }))
}

function buildIncidences(summary: {
  invoiceCount: number
  paymentCount: number
  closureExpenseCount: number
  pendingInvoiceCount: number
  missingSupportCount: number
  pendingReviewCount: number
  riskCount: number
}, periodLabel: string): ClosingSummaryIncidence[] {
  return [
    {
      id: 'period_invoices_all',
      label: 'Facturas emitidas',
      detail: `Base fiscal incluida en ${periodLabel}.`,
      count: summary.invoiceCount,
      tone: 'neutral',
      view: 'invoices',
      scope: 'all',
    },
    {
      id: 'period_payments_all',
      label: 'Cobros registrados',
      detail: `Cobros con fecha dentro de ${periodLabel}.`,
      count: summary.paymentCount,
      tone: 'neutral',
      view: 'payments',
      scope: 'all',
    },
    {
      id: 'period_expenses_closure',
      label: 'Gastos relevantes para cierre',
      detail: 'Registros marcados como material de revisión fiscal y documental.',
      count: summary.closureExpenseCount,
      tone: 'neutral',
      view: 'expenses',
      scope: 'closure',
    },
    {
      id: 'period_invoices_pending',
      label: 'Facturas con saldo pendiente',
      detail: 'Facturas emitidas en el periodo que siguen abiertas hoy.',
      count: summary.pendingInvoiceCount,
      tone: summary.pendingInvoiceCount > 0 ? 'warning' : 'neutral',
      view: 'invoices',
      scope: 'pending',
    },
    {
      id: 'period_expenses_missing_support',
      label: 'Gastos sin soporte',
      detail: 'Documentación faltante o insuficiente para cierre.',
      count: summary.missingSupportCount,
      tone: summary.missingSupportCount > 0 ? 'danger' : 'neutral',
      view: 'expenses',
      scope: 'missing_support',
    },
    {
      id: 'period_expenses_pending_review',
      label: 'Gastos pendientes de revisión',
      detail: 'Registros que todavía requieren validación fiscal.',
      count: summary.pendingReviewCount,
      tone: summary.pendingReviewCount > 0 ? 'warning' : 'neutral',
      view: 'expenses',
      scope: 'pending_review',
    },
    {
      id: 'period_expenses_risk',
      label: 'Gastos con riesgo medio/alto',
      detail: 'Casos prioritarios para revisar antes de exportar.',
      count: summary.riskCount,
      tone: summary.riskCount > 0 ? 'warning' : 'neutral',
      view: 'expenses',
      scope: 'risk',
    },
  ]
}

export function buildClosingSummary({
  selection,
  invoices,
  payments,
  expenses,
  quotes,
  quarterlySummaryByPeriod,
  annualSummaryByYear,
}: BuildClosingSummaryInput): ClosingSummary {
  const period = resolveFiscalPeriod(selection)
  const periodInvoices = invoices.filter((invoice) => isDateWithinFiscalPeriod(invoice.issue_date, period))
  const periodPayments = payments.filter((payment) => isDateWithinFiscalPeriod(payment.payment_date, period))
  const periodExpenses = expenses.filter((expense) => isExpenseWithinPeriod(expense, period))
  const periodQuotes = quotes.filter((quote) => isDateWithinFiscalPeriod(quote.created_at ?? null, period))
  const closureExpenses = periodExpenses.filter(getClosurePredicate(period))
  const missingSupportExpenses = closureExpenses.filter(
    (expense) =>
      expense.document_support_status === 'missing' ||
      (!expense.receipt_file_path && expense.document_support_status !== 'invoice_valid'),
  )
  const pendingReviewExpenses = closureExpenses.filter((expense) => needsFiscalReview(expense))
  const riskExpenses = closureExpenses.filter((expense) => hasMediumHighFiscalRisk(expense))

  const invoicePaidById = new Map<string, number>()
  for (const payment of payments) {
    invoicePaidById.set(payment.invoice_id, (invoicePaidById.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0))
  }

  const pendingInvoices = periodInvoices.filter((invoice) => {
    const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
    return Math.max(Number(invoice.total || 0) - paidAmount, 0) > 0.009
  })

  const vatSummary = buildFiscalVatSummary(periodInvoices, closureExpenses)
  const fallbackFiscalYear = Number(period.startDate.slice(0, 4))
  const fallbackFiscalQuarter = period.mode === 'quarter'
    ? Math.floor((Number(period.startDate.slice(5, 7)) - 1) / 3) + 1
    : null

  const quarterSummary = period.mode === 'quarter'
    ? quarterlySummaryByPeriod.get(`${selection.year}-Q${selection.quarter}`)
    : undefined
  const annualSummary = period.mode === 'year'
    ? annualSummaryByYear.get(selection.year)
    : undefined

  const baseSummary = quarterSummary ?? annualSummary

  const invoiceCount = baseSummary?.invoiceCount ?? periodInvoices.length
  const paymentCount = baseSummary?.paymentCount ?? periodPayments.length
  const expenseCount = baseSummary?.expenseCount ?? periodExpenses.length
  const closureExpenseCount = baseSummary?.closureExpenseCount ?? closureExpenses.length
  const missingSupportCount = baseSummary?.missingSupportCount ?? missingSupportExpenses.length
  const pendingReviewCount = baseSummary?.pendingReviewCount ?? pendingReviewExpenses.length
  const riskCount = baseSummary?.riskCount ?? riskExpenses.length
  const fiscalReviewCount = baseSummary?.fiscalReviewCount ?? vatSummary.expenseFiscalSummary.needsReviewCount
  const fiscalRiskCount = baseSummary?.fiscalRiskCount ?? vatSummary.expenseFiscalSummary.mediumHighRiskCount
  const missingValidVatInvoiceCount = baseSummary?.missingValidVatInvoiceCount ?? vatSummary.expenseFiscalSummary.missingValidVatInvoiceCount
  const pendingInvoiceCount = baseSummary?.pendingInvoiceCount ?? pendingInvoices.length
  const unresolvedIncidenceCount = baseSummary?.unresolvedIncidenceCount
    ?? (missingSupportCount + pendingReviewCount + riskCount + missingValidVatInvoiceCount + pendingInvoiceCount)
  const invoicedTotal = baseSummary?.invoicedTotal ?? Number(periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0).toFixed(2))
  const collectedTotal = baseSummary?.collectedTotal ?? Number(periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2))
  const outstandingTotal = baseSummary?.outstandingTotal ?? Number(
    pendingInvoices.reduce((sum, invoice) => {
      const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
      return sum + Math.max(Number(invoice.total || 0) - paidAmount, 0)
    }, 0).toFixed(2),
  )
  const expensesTotal = baseSummary?.expensesTotal ?? Number(periodExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0).toFixed(2))
  const outputVatTotal = baseSummary?.outputVatTotal ?? vatSummary.outputVatTotal
  const estimatedDeductibleBase = baseSummary?.estimatedDeductibleBase ?? vatSummary.estimatedDeductibleBase
  const estimatedDeductibleVat = baseSummary?.estimatedDeductibleVat ?? vatSummary.estimatedDeductibleVat
  const totalVatSupported = baseSummary?.totalVatSupported ?? vatSummary.supportedVatTotal
  const estimatedNetVatPayable = baseSummary?.estimatedNetVatPayable ?? vatSummary.estimatedNetVatPayable
  const readiness = baseSummary?.readiness ?? (unresolvedIncidenceCount > 0 ? 'issues' : 'ready')

  return {
    period,
    snapshotMode: period.mode === 'quarter' ? 'quarterly' : period.mode === 'year' ? 'annual' : null,
    fiscalYear: baseSummary?.fiscalYear ?? fallbackFiscalYear,
    fiscalQuarter: quarterSummary?.fiscalQuarter ?? fallbackFiscalQuarter,
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
    outputVatTotal,
    estimatedDeductibleBase,
    estimatedDeductibleVat,
    totalVatSupported,
    estimatedNetVatPayable,
    readiness,
    invoices: periodInvoices,
    payments: periodPayments,
    expenses: periodExpenses,
    closureExpenses,
    quotes: periodQuotes,
    pendingInvoices,
    missingSupportExpenses,
    pendingReviewExpenses,
    riskExpenses,
    incidences: buildIncidences({
      invoiceCount,
      paymentCount,
      closureExpenseCount,
      pendingInvoiceCount,
      missingSupportCount,
      pendingReviewCount,
      riskCount,
    }, period.label),
    quarterBreakdown: buildQuarterBreakdown(annualSummary),
  }
}
