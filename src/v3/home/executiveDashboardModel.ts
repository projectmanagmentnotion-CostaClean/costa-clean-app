import type { ExpenseListItem } from '../../features/expenses/types'
import { getEstimatedDeductibleVat, hasValidVatInvoiceSupport } from '../../features/expenses/fiscalIntelligenceSummary'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { buildInvoicePaymentCohort } from '../../features/closing/invoicePaymentCohort'
import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'

export type DashboardPeriodKind = 'month' | 'quarter' | 'year'
export interface DashboardPeriodSelection { kind: DashboardPeriodKind; key: string }
export interface DashboardPeriodOption extends DashboardPeriodSelection { label: string }
export interface DashboardTrendPoint { key: string; label: string; invoiced: number; collected: number; expenses: number }
export interface DashboardGrowth { invoiced: number | null; collected: number | null; expenses: number | null; result: number | null }
export interface ExecutiveDashboardModel {
  period: DashboardPeriodOption
  previousPeriod: DashboardPeriodOption
  hasData: boolean
  hasComparableData: boolean
  invoiced: number
  collected: number
  outstanding: number
  expenses: number
  estimatedResult: number
  outputVat: number
  inputVat: number
  estimatedVat: number
  growth: DashboardGrowth
  trend: DashboardTrendPoint[]
  operational: { scheduledJobs: number; completedJobs: number; completedUnbilledJobs: number; openQuotes: number; acceptedQuotes: number; expensesWithoutSupport: number; alerts: number }
}

export interface ExecutiveDashboardInput {
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
}

function dateOf(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

function keyOf(value: string | null | undefined, kind: DashboardPeriodKind): string | null {
  const date = dateOf(value)
  if (!date) return null
  if (kind === 'year') return String(date.getFullYear())
  if (kind === 'quarter') return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftKey(selection: DashboardPeriodSelection, offset: number): string {
  const [yearText, suffix] = selection.key.split('-')
  const year = Number(yearText)
  if (selection.kind === 'year') return String(year + offset)
  if (selection.kind === 'quarter') {
    const quarter = Number(suffix?.replace('Q', '') ?? 1)
    const index = year * 4 + quarter - 1 + offset
    return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`
  }
  const date = new Date(year, Number(suffix ?? 1) - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function labelFor(kind: DashboardPeriodKind, key: string): string {
  if (kind === 'year') return key
  if (kind === 'quarter') return key.replace('-', ' · ').replace('Q', 'T')
  const [year, month] = key.split('-')
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' })
    .format(new Date(Number(year), Number(month) - 1, 1))
}

function option(kind: DashboardPeriodKind, key: string): DashboardPeriodOption {
  return { kind, key, label: labelFor(kind, key) }
}

function isVisible<T extends { archived_at?: string | null; deleted_at?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !isArchivedEntity(item) && !isDeletedEntity(item))
}

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(2))
}

function inPeriod(value: string | null | undefined, selection: DashboardPeriodSelection): boolean {
  return keyOf(value, selection.kind) === selection.key
}

function metricFor(input: ExecutiveDashboardInput, selection: DashboardPeriodSelection) {
  const invoices = isVisible(input.invoices).filter((invoice) =>
    inPeriod(invoice.issue_date, selection) && !isCancelledEntity(invoice),
  )
  const paymentCohort = buildInvoicePaymentCohort(input.payments, invoices)
  const payments = paymentCohort.payments
  const expenses = isVisible(input.expenses).filter((expense) =>
    inPeriod(expense.expense_date, selection) && !isCancelledEntity(expense),
  )
  const jobs = isVisible(input.jobs).filter((job) =>
    inPeriod(job.scheduled_date, selection) && !isCancelledEntity(job),
  )
  const quotes = isVisible(input.quotes).filter((quote) =>
    inPeriod(quote.created_at, selection) && !isCancelledEntity(quote),
  )
  const invoiceIds = new Set(isVisible(input.invoices)
    .filter((invoice) => !isCancelledEntity(invoice))
    .map((invoice) => invoice.id))
  const outstanding = sum(invoices.map((invoice) => Math.max(
    Number(invoice.outstanding_amount ?? Number(invoice.total || 0) - (invoice.paid_amount ?? paymentCohort.paidAmountByInvoiceId.get(invoice.id) ?? 0)),
    0,
  )))
  const invoiced = sum(invoices.map((invoice) => Number(invoice.total || 0)))
  const collected = sum(payments.map((payment) => Number(payment.amount || 0)))
  const expensesTotal = sum(expenses.map((expense) => Number(expense.total || 0)))
  const outputVat = sum(invoices.map((invoice) => Number(invoice.tax_amount || 0)))
  const inputVat = sum(expenses.filter(hasValidVatInvoiceSupport).map(getEstimatedDeductibleVat))

  return {
    invoiced,
    collected,
    outstanding,
    expenses: expensesTotal,
    estimatedResult: Number((invoiced - expensesTotal).toFixed(2)),
    outputVat,
    inputVat,
    estimatedVat: Number((outputVat - inputVat).toFixed(2)),
    operational: {
      scheduledJobs: jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      completedUnbilledJobs: jobs.filter((job) => job.status === 'completed' && !job.invoice_id && !input.invoices.some((invoice) => invoice.job_id === job.id && invoiceIds.has(invoice.id))).length,
      openQuotes: quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent').length,
      acceptedQuotes: quotes.filter((quote) => quote.status === 'accepted').length,
      expensesWithoutSupport: expenses.filter((expense) => !expense.receipt_file_path || expense.document_support_status !== 'invoice_valid').length,
    },
    hasData: invoices.length + payments.length + expenses.length + jobs.length + quotes.length > 0,
  }
}

function growth(current: number, previous: number, comparable: boolean): number | null {
  if (!comparable || Math.abs(previous) <= 0.009) return null
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

export function buildExecutiveDashboardModel(
  input: ExecutiveDashboardInput,
  selection: DashboardPeriodSelection,
  alertCount = 0,
): ExecutiveDashboardModel {
  const current = metricFor(input, selection)
  const previousPeriod = option(selection.kind, shiftKey(selection, -1))
  const previous = metricFor(input, previousPeriod)
  const comparable = previous.hasData
  const trend = Array.from({ length: 6 }, (_, index) => {
    const period = option(selection.kind, shiftKey(selection, index - 5))
    const values = metricFor(input, period)
    return { key: period.key, label: period.label, invoiced: values.invoiced, collected: values.collected, expenses: values.expenses }
  })

  return {
    period: option(selection.kind, selection.key),
    previousPeriod,
    hasComparableData: comparable,
    ...current,
    growth: {
      invoiced: growth(current.invoiced, previous.invoiced, comparable),
      collected: growth(current.collected, previous.collected, comparable),
      expenses: growth(current.expenses, previous.expenses, comparable),
      result: growth(current.estimatedResult, previous.estimatedResult, comparable),
    },
    trend,
    operational: { ...current.operational, alerts: alertCount },
  }
}
