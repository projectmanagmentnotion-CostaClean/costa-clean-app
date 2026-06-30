import type { AnnualClosingSummary } from '../annualClosing/types'
import {
  buildClosingDeterministicSummary,
  type ClosingDeterministicSummary,
} from './closingDeterministicSummary'
import type { ExpenseListItem } from '../expenses/types'
import { buildFiscalVatSummary } from './fiscalVatSummary'
import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from '../jobs/types'
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

export type ClosingReadinessLevel = 'ready' | 'review' | 'blocked'

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
  readinessLevel: ClosingReadinessLevel
  supportedClosureExpenseCount: number
  validVatInvoiceSupportCount: number
  closureDocumentCoverageRate: number
  supportedVatCoverageRate: number
  criticalIncidenceCount: number
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  closureExpenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  pendingInvoices: InvoiceListItem[]
  missingSupportExpenses: ExpenseListItem[]
  pendingReviewExpenses: ExpenseListItem[]
  riskExpenses: ExpenseListItem[]
  incidences: ClosingSummaryIncidence[]
  quarterBreakdown: ClosingQuarterBreakdownItem[]
  deterministicSummary: ClosingDeterministicSummary
}

interface BuildClosingSummaryInput {
  selection: FiscalPeriodSelection
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
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

function getClosingReadinessLevel(input: {
  missingSupportCount: number
  missingValidVatInvoiceCount: number
  pendingReviewCount: number
  riskCount: number
  pendingInvoiceCount: number
}): ClosingReadinessLevel {
  if (input.missingSupportCount > 0 || input.missingValidVatInvoiceCount > 0) return 'blocked'
  if (input.pendingReviewCount > 0 || input.riskCount > 0 || input.pendingInvoiceCount > 0) return 'review'
  return 'ready'
}

export function buildClosingSummary({
  selection,
  invoices,
  payments,
  expenses,
  quotes,
  jobs,
  quarterlySummaryByPeriod,
  annualSummaryByYear,
}: BuildClosingSummaryInput): ClosingSummary {
  const period = resolveFiscalPeriod(selection)
  const periodInvoices = invoices.filter((invoice) => isDateWithinFiscalPeriod(invoice.issue_date, period))
  const periodPayments = payments.filter((payment) => isDateWithinFiscalPeriod(payment.payment_date, period))
  const periodExpenses = expenses.filter((expense) => isExpenseWithinPeriod(expense, period))
  const periodQuotes = quotes.filter((quote) => isDateWithinFiscalPeriod(quote.created_at ?? null, period))
  const periodJobs = jobs.filter((job) => isDateWithinFiscalPeriod(job.scheduled_date, period))
  const deterministic = buildClosingDeterministicSummary({
    period,
    invoices,
    payments,
    expenses,
    quotes,
    jobs,
    hasPersistedSnapshot: false,
  })
  const {
    closureExpenses,
    pendingInvoices,
    missingSupportExpenses,
    pendingReviewExpenses,
    riskExpenses,
  } = deterministic.collections
  const supportedClosureExpenses = closureExpenses.filter(
    (expense) => expense.document_support_status !== 'missing' && Boolean(expense.receipt_file_path),
  )
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
  const fiscalReviewCount = baseSummary?.fiscalReviewCount ?? deterministic.expenseFiscalSummary.needsReviewCount
  const fiscalRiskCount = baseSummary?.fiscalRiskCount ?? deterministic.expenseFiscalSummary.mediumHighRiskCount
  const missingValidVatInvoiceCount = baseSummary?.missingValidVatInvoiceCount ?? deterministic.expenseFiscalSummary.missingValidVatInvoiceCount
  const pendingInvoiceCount = baseSummary?.pendingInvoiceCount ?? pendingInvoices.length
  const unresolvedIncidenceCount = baseSummary?.unresolvedIncidenceCount
    ?? (missingSupportCount + pendingReviewCount + riskCount + missingValidVatInvoiceCount + pendingInvoiceCount)
  const invoicedTotal = baseSummary?.invoicedTotal ?? Number(periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0).toFixed(2))
  const collectedTotal = baseSummary?.collectedTotal ?? Number(periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0).toFixed(2))
  const outstandingTotal = baseSummary?.outstandingTotal ?? deterministic.summary.totalOutstanding
  const expensesTotal = baseSummary?.expensesTotal ?? Number(periodExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0).toFixed(2))
  const outputVatTotal = baseSummary?.outputVatTotal ?? vatSummary.outputVatTotal
  const estimatedDeductibleBase = baseSummary?.estimatedDeductibleBase ?? vatSummary.estimatedDeductibleBase
  const estimatedDeductibleVat = baseSummary?.estimatedDeductibleVat ?? vatSummary.estimatedDeductibleVat
  const totalVatSupported = baseSummary?.totalVatSupported ?? vatSummary.supportedVatTotal
  const estimatedNetVatPayable = baseSummary?.estimatedNetVatPayable ?? vatSummary.estimatedNetVatPayable
  const readiness = baseSummary?.readiness ?? (unresolvedIncidenceCount > 0 ? 'issues' : 'ready')
  const readinessLevel = getClosingReadinessLevel({
    missingSupportCount,
    missingValidVatInvoiceCount,
    pendingReviewCount,
    riskCount,
    pendingInvoiceCount,
  })
  const closureDocumentCoverageRate = closureExpenseCount > 0
    ? Number(((supportedClosureExpenses.length / closureExpenseCount) * 100).toFixed(1))
    : 100
  const supportedVatCoverageRate = totalVatSupported > 0
    ? Number(((estimatedDeductibleVat / totalVatSupported) * 100).toFixed(1))
    : 100

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
    readinessLevel,
    supportedClosureExpenseCount: supportedClosureExpenses.length,
    validVatInvoiceSupportCount: closureExpenseCount - missingValidVatInvoiceCount,
    closureDocumentCoverageRate,
    supportedVatCoverageRate,
    criticalIncidenceCount: missingSupportCount + missingValidVatInvoiceCount,
    invoices: periodInvoices,
    payments: periodPayments,
    expenses: periodExpenses,
    closureExpenses,
    quotes: periodQuotes,
    jobs: periodJobs,
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
    deterministicSummary: {
      ...deterministic.summary,
      period: {
        ...deterministic.summary.period,
        fiscalYear: baseSummary?.fiscalYear ?? fallbackFiscalYear,
        fiscalQuarter: quarterSummary?.fiscalQuarter ?? fallbackFiscalQuarter,
      },
      totalInvoiced: invoicedTotal,
      totalCollected: collectedTotal,
      totalOutstanding: outstandingTotal,
      totalExpenses: expensesTotal,
      outputVatTotal,
      supportedVatTotal: totalVatSupported,
      estimatedDeductibleBase,
      estimatedDeductibleVat,
      estimatedNetVatPayable,
      pendingInvoicesCount: pendingInvoiceCount,
      expensesWithoutSupportCount: missingSupportCount,
      expensesPendingReviewCount: pendingReviewCount,
      expensesMediumHighRiskCount: riskCount,
      openIncidencesCount: unresolvedIncidenceCount,
      sourceCounts: {
        ...deterministic.summary.sourceCounts,
        invoices: invoiceCount,
        payments: paymentCount,
        expenses: expenseCount,
        closureExpenses: closureExpenseCount,
        quotes: periodQuotes.length,
        jobs: periodJobs.length,
      },
    },
  }
}
