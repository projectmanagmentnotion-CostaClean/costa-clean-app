import { useMemo } from 'react'
import type { ClientListItem } from '../features/clients/types'
import type { ExpenseListItem } from '../features/expenses/types'
import { buildExpenseFiscalSummary } from '../features/expenses/fiscalIntelligenceSummary'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { LeadListItem } from '../features/leads/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import { isRecurringPlanDue } from '../features/recurringInvoices/recurringInvoiceSchedule'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'

function getExpenseMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getExpenseQuarterKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

function getMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getDateKey(dateValue: string): string | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDayKey(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isOlderThanDays(dateValue: string, days: number): boolean {
  if (!dateValue) return false
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

interface UseDashboardMetricsInput {
  leads: LeadListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  jobs: JobListItem[]
  invoices: InvoiceListItem[]
  expenses: ExpenseListItem[]
  payments: PaymentListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
}

export function useDashboardMetrics({
  leads,
  clients,
  properties,
  quotes,
  jobs,
  invoices,
  expenses,
  payments,
  recurringInvoicePlans,
}: UseDashboardMetricsInput) {
  return useMemo(() => {
    const invoicePaidById = new Map<string, number>()
    for (const payment of payments) {
      const currentPaid = invoicePaidById.get(payment.invoice_id) ?? 0
      invoicePaidById.set(payment.invoice_id, currentPaid + Number(payment.amount || 0))
    }

    const invoiceIdsWithLinks = new Set(invoices.map((invoice) => invoice.job_id))
    const quoteIdsWithJobs = new Set(jobs.map((job) => job.quote_id).filter(Boolean))
    const openQuotesCount = quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent').length
    const scheduledJobsCount = jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length
    const pendingInvoicesCount = invoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled').length
    const completedJobsWithoutInvoiceCount = jobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id)).length
    const acceptedQuotesWithoutJobCount = quotes.filter((quote) => quote.status === 'accepted' && !quoteIdsWithJobs.has(quote.id)).length
    const unpaidInvoicesOlderThan7DaysCount = invoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && invoice.status !== 'cancelled' && isOlderThanDays(invoice.issue_date, 7)).length
    const sentQuotesOlderThan5DaysCount = quotes.filter((quote) => quote.status === 'sent' && isOlderThanDays(quote.created_at ?? '', 5)).length
    const completedJobsWithoutInvoiceOlderThan2DaysCount = jobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id) && isOlderThanDays(job.scheduled_date, 2)).length
    const dueRecurringPlansCount = recurringInvoicePlans.filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date)).length
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0)
    const expensesWithReceiptCount = expenses.filter((expense) => Boolean(expense.receipt_file_path)).length
    const expensesWithoutReceiptCount = expenses.filter((expense) => !expense.receipt_file_path).length
    const deductibleExpensesCount = expenses.filter((expense) => expense.is_deductible).length
    const expenseFiscalSummary = buildExpenseFiscalSummary(expenses)

    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentQuarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
    const todayKey = createDayKey(0)
    const tomorrowKey = createDayKey(1)
    const invoicedThisMonthTotal = invoices
      .filter((invoice) => getMonthKey(invoice.issue_date) === currentMonthKey)
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    const collectedThisMonthTotal = payments
      .filter((payment) => getMonthKey(payment.payment_date) === currentMonthKey)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const outstandingReceivablesTotal = invoices.reduce((sum, invoice) => {
      if ((invoice.outstanding_amount ?? 0) <= 0.009) {
        return sum
      }

      const invoiceTotal = Number(invoice.total || 0)
      const paidAmount = invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0
      const remainingAmount = invoice.outstanding_amount ?? Math.max(invoiceTotal - paidAmount, 0)
      return sum + remainingAmount
    }, 0)

    const expensesThisMonthTotal = expenses
      .filter((expense) => getExpenseMonthKey(expense.expense_date) === currentMonthKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const expensesThisQuarterTotal = expenses
      .filter((expense) => getExpenseQuarterKey(expense.expense_date) === currentQuarterKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const jobsScheduledTodayCount = jobs.filter((job) => getDateKey(job.scheduled_date) === todayKey && job.status !== 'cancelled').length
    const jobsScheduledTomorrowCount = jobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey && job.status !== 'cancelled').length

    return {
      leadsCount: leads.length,
      clientsCount: clients.length,
      propertiesCount: properties.length,
      quotesCount: quotes.length,
      jobsCount: jobs.length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
      expensesCount: expenses.length,
      openQuotesCount,
      scheduledJobsCount,
      pendingInvoicesCount,
      invoicedThisMonthTotal,
      collectedThisMonthTotal,
      outstandingReceivablesTotal,
      completedJobsWithoutInvoiceCount,
      acceptedQuotesWithoutJobCount,
      unpaidInvoicesOlderThan7DaysCount,
      sentQuotesOlderThan5DaysCount,
      completedJobsWithoutInvoiceOlderThan2DaysCount,
      jobsScheduledTodayCount,
      jobsScheduledTomorrowCount,
      dueRecurringPlansCount,
      totalInvoiced,
      totalCollected,
      totalExpenses,
      expensesThisMonthTotal,
      expensesThisQuarterTotal,
      expensesWithReceiptCount,
      expensesWithoutReceiptCount,
      deductibleExpensesCount,
      estimatedDeductibleVat: expenseFiscalSummary.estimatedDeductibleVat,
      estimatedDeductibleBase: expenseFiscalSummary.estimatedDeductibleBase,
      fiscalReviewExpensesCount: expenseFiscalSummary.needsReviewCount,
      fiscalRiskExpensesCount: expenseFiscalSummary.mediumHighRiskCount,
      expensesMissingValidVatInvoiceCount: expenseFiscalSummary.missingValidVatInvoiceCount,
      expensesZeroEstimatedVatCount: expenseFiscalSummary.zeroEstimatedVatCount,
    }
  }, [leads, clients, properties, quotes, jobs, invoices, expenses, payments, recurringInvoicePlans])
}
