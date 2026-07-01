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
import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../shared/lifecycle/entityLifecycle'

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
    const visibleLeads = leads.filter((lead) => !isArchivedEntity(lead) && !isDeletedEntity(lead))
    const visibleClients = clients.filter((client) => !isArchivedEntity(client) && !isDeletedEntity(client) && client.status !== 'inactive')
    const visibleProperties = properties.filter((property) => !isArchivedEntity(property) && !isDeletedEntity(property))
    const visibleQuotes = quotes.filter((quote) => !isArchivedEntity(quote) && !isDeletedEntity(quote))
    const visibleJobs = jobs.filter((job) => !isArchivedEntity(job) && !isDeletedEntity(job))
    const visibleInvoices = invoices.filter((invoice) => !isArchivedEntity(invoice) && !isDeletedEntity(invoice))
    const visibleExpenses = expenses.filter((expense) => !isArchivedEntity(expense) && !isDeletedEntity(expense))
    const invoicePaidById = new Map<string, number>()
    for (const payment of payments) {
      const currentPaid = invoicePaidById.get(payment.invoice_id) ?? 0
      invoicePaidById.set(payment.invoice_id, currentPaid + Number(payment.amount || 0))
    }

    const invoiceIdsWithLinks = new Set(visibleInvoices.map((invoice) => invoice.job_id))
    const quoteIdsWithJobs = new Set(visibleJobs.map((job) => job.quote_id).filter(Boolean))
    const openQuotesCount = visibleQuotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent').length
    const scheduledJobsCount = visibleJobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress').length
    const pendingInvoicesCount = visibleInvoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && !isCancelledEntity(invoice)).length
    const partiallyPaidInvoicesCount = visibleInvoices.filter((invoice) => invoice.payment_status === 'partially_paid').length
    const completedJobsWithoutInvoiceCount = visibleJobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id)).length
    const acceptedQuotesWithoutJobCount = visibleQuotes.filter((quote) => quote.status === 'accepted' && !quoteIdsWithJobs.has(quote.id)).length
    const unpaidInvoicesOlderThan7DaysCount = visibleInvoices.filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && !isCancelledEntity(invoice) && isOlderThanDays(invoice.issue_date, 7)).length
    const sentQuotesOlderThan5DaysCount = visibleQuotes.filter((quote) => quote.status === 'sent' && isOlderThanDays(quote.created_at ?? '', 5)).length
    const completedJobsWithoutInvoiceOlderThan2DaysCount = visibleJobs.filter((job) => job.status === 'completed' && !invoiceIdsWithLinks.has(job.id) && isOlderThanDays(job.scheduled_date, 2)).length
    const dueRecurringPlansCount = recurringInvoicePlans.filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date)).length
    const pausedRecurringPlansCount = recurringInvoicePlans.filter((plan) => plan.status === 'paused').length
    const totalInvoiced = visibleInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const totalExpenses = visibleExpenses.reduce((sum, expense) => sum + Number(expense.total || 0), 0)
    const expensesWithReceiptCount = visibleExpenses.filter((expense) => Boolean(expense.receipt_file_path)).length
    const expensesWithoutReceiptCount = visibleExpenses.filter((expense) => !expense.receipt_file_path).length
    const deductibleExpensesCount = visibleExpenses.filter((expense) => expense.is_deductible).length
    const expenseFiscalSummary = buildExpenseFiscalSummary(visibleExpenses)

    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentQuarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
    const todayKey = createDayKey(0)
    const tomorrowKey = createDayKey(1)
    const invoicedThisMonthTotal = visibleInvoices
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

    const expensesThisMonthTotal = visibleExpenses
      .filter((expense) => getExpenseMonthKey(expense.expense_date) === currentMonthKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const expensesThisQuarterTotal = visibleExpenses
      .filter((expense) => getExpenseQuarterKey(expense.expense_date) === currentQuarterKey)
      .reduce((sum, expense) => sum + Number(expense.total || 0), 0)

    const jobsScheduledTodayCount = visibleJobs.filter((job) => getDateKey(job.scheduled_date) === todayKey && !isCancelledEntity(job)).length
    const jobsScheduledTomorrowCount = visibleJobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey && !isCancelledEntity(job)).length
    const clientsWithPendingBalanceCount = new Set(
      visibleInvoices
        .filter((invoice) => (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009 && !isCancelledEntity(invoice))
        .map((invoice) => invoice.client_id),
    ).size
    const clientsMissingFiscalDataCount = visibleClients.filter(
      (client) => !client.tax_id?.trim() || !client.billing_address?.trim(),
    ).length
    const propertyAnomalyCount = visibleProperties.filter((property) => {
      const hasJobMismatch = visibleJobs.some((job) => job.property_id === property.id && job.client_id !== property.client_id)
      const hasQuoteMismatch = visibleQuotes.some((quote) => quote.property_id === property.id && quote.client_id && quote.client_id !== property.client_id)
      const hasInvoiceMismatch = visibleInvoices.some((invoice) => invoice.property_id === property.id && invoice.client_id !== property.client_id)
      return hasJobMismatch || hasQuoteMismatch || hasInvoiceMismatch
    }).length

    return {
      leadsCount: visibleLeads.length,
      clientsCount: visibleClients.length,
      propertiesCount: visibleProperties.length,
      quotesCount: visibleQuotes.length,
      jobsCount: visibleJobs.length,
      invoicesCount: visibleInvoices.length,
      paymentsCount: payments.length,
      expensesCount: visibleExpenses.length,
      openQuotesCount,
      scheduledJobsCount,
      pendingInvoicesCount,
      partiallyPaidInvoicesCount,
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
      pausedRecurringPlansCount,
      clientsWithPendingBalanceCount,
      clientsMissingFiscalDataCount,
      propertyAnomalyCount,
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
