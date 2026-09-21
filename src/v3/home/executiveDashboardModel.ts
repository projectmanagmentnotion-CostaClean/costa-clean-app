import type { ExpenseListItem } from '../../features/expenses/types'
import { getEstimatedDeductibleVat, hasValidVatInvoiceSupport } from '../../features/expenses/fiscalIntelligenceSummary'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { QuoteListItem } from '../../features/quotes/types'
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
  operational: { scheduledJobs: number; completedJobs: number; completedUnbilledJobs: number; openQuotes: number; acceptedQuotes: number; overdueInvoices: number; expensesWithoutSupport: number; alerts: number }
}

type Input = { invoices: InvoiceListItem[]; payments: PaymentListItem[]; expenses: ExpenseListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[] }
const DAY = 86_400_000

function dateOf(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.length > 10 ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
function keyOf(value: string | null | undefined, kind: DashboardPeriodKind): string | null {
  const date = dateOf(value)
  if (!date) return null
  if (kind === 'year') return String(date.getFullYear())
  if (kind === 'quarter') return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function currentKey(kind: DashboardPeriodKind, now = new Date()): string { return keyOf(now.toISOString(), kind) ?? '' }
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
  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(Number(year), Number(month) - 1, 1))
}
function option(kind: DashboardPeriodKind, key: string): DashboardPeriodOption { return { kind, key, label: labelFor(kind, key) } }
function visible<T extends { archived_at?: string | null; deleted_at?: string | null }>(items: T[]): T[] { return items.filter((item) => !isArchivedEntity(item) && !isDeletedEntity(item)) }
function sum(items: number[]): number { return Number(items.reduce((total, value) => total + value, 0).toFixed(2)) }
function inPeriod(value: string | null | undefined, selection: DashboardPeriodSelection): boolean { return keyOf(value, selection.kind) === selection.key }
function metricFor(input: Input, selection: DashboardPeriodSelection) {
  const invoices = visible(input.invoices).filter((invoice) => inPeriod(invoice.issue_date, selection) && !isCancelledEntity(invoice))
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id))
  const payments = input.payments.filter((payment) => inPeriod(payment.payment_date, selection) && invoiceIds.has(payment.invoice_id))
  const expenses = visible(input.expenses).filter((expense) => inPeriod(expense.expense_date, selection) && !isCancelledEntity(expense))
  const jobs = visible(input.jobs).filter((job) => inPeriod(job.scheduled_date, selection) && !isCancelledEntity(job))
  const quotes = visible(input.quotes).filter((quote) => inPeriod(quote.created_at, selection) && !isCancelledEntity(quote))
  const paidByInvoice = new Map<string, number>()
  for (const payment of input.payments) paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0))
  const outstanding = sum(invoices.map((invoice) => Math.max(Number(invoice.outstanding_amount ?? Number(invoice.total || 0) - (invoice.paid_amount ?? paidByInvoice.get(invoice.id) ?? 0)), 0)))
  const invoiced = sum(invoices.map((invoice) => Number(invoice.total || 0)))
  const collected = sum(payments.map((payment) => Number(payment.amount || 0)))
  const expensesTotal = sum(expenses.map((expense) => Number(expense.total || 0)))
  const outputVat = sum(invoices.map((invoice) => Number(invoice.tax_amount || 0)))
  const inputVat = sum(expenses.filter(hasValidVatInvoiceSupport).map(getEstimatedDeductibleVat))
  return {
    invoiced, collected, outstanding, expenses: expensesTotal, estimatedResult: Number((invoiced - expensesTotal).toFixed(2)), outputVat, inputVat, estimatedVat: Number((outputVat - inputVat).toFixed(2)),
    operational: {
      scheduledJobs: jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      completedUnbilledJobs: jobs.filter((job) => job.status === 'completed' && !input.invoices.some((invoice) => invoice.job_id === job.id && !isCancelledEntity(invoice))).length,
      openQuotes: quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent').length,
      acceptedQuotes: quotes.filter((quote) => quote.status === 'accepted').length,
      overdueInvoices: invoices.filter((invoice) => Number(invoice.outstanding_amount ?? 0) > 0.009 && dateOf(invoice.issue_date) && dateOf(invoice.issue_date)!.getTime() < Date.now() - 30 * DAY).length,
      expensesWithoutSupport: expenses.filter((expense) => !expense.receipt_file_path || expense.document_support_status !== 'invoice_valid').length,
      alerts: 0,
    },
    hasData: invoices.length + payments.length + expenses.length + jobs.length + quotes.length > 0,
  }
}
function growth(current: number, previous: number, comparable: boolean): number | null { return comparable && Math.abs(previous) > 0.009 ? Number(((current - previous) / Math.abs(previous) * 100).toFixed(1)) : null }
export function getDashboardPeriodOptions(kind: DashboardPeriodKind, input: Input, now = new Date()): DashboardPeriodOption[] {
  const keys = new Set<string>([currentKey(kind, now)])
  for (const item of [...input.invoices, ...input.payments, ...input.expenses]) { const value = keyOf('issue_date' in item ? item.issue_date : 'payment_date' in item ? item.payment_date : item.expense_date, kind); if (value) keys.add(value) }
  return [...keys].sort().reverse().slice(0, kind === 'year' ? 6 : 12).map((key) => option(kind, key))
}
export function buildExecutiveDashboardModel(input: Input, selection: DashboardPeriodSelection, alertCount = 0): ExecutiveDashboardModel {
  const current = metricFor(input, selection)
  const previousPeriod = option(selection.kind, shiftKey(selection, -1))
  const previous = metricFor(input, previousPeriod)
  const comparable = previous.hasData
  const trend = Array.from({ length: 6 }, (_, index) => { const item = option(selection.kind, shiftKey(selection, index - 5)); const values = metricFor(input, item); return { key: item.key, label: item.label, invoiced: values.invoiced, collected: values.collected, expenses: values.expenses } })
  return { period: option(selection.kind, selection.key), previousPeriod, hasComparableData: comparable, ...current, growth: { invoiced: growth(current.invoiced, previous.invoiced, comparable), collected: growth(current.collected, previous.collected, comparable), expenses: growth(current.expenses, previous.expenses, comparable), result: growth(current.estimatedResult, previous.estimatedResult, comparable) }, trend, operational: { ...current.operational, alerts: alertCount } }
}
