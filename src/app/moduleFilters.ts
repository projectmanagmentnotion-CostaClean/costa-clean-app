import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import type { QuoteListItem } from '../features/quotes/types'

export type InvoiceModuleFilter = 'pending' | 'current_month' | 'unpaid_older_7d'
export type QuoteModuleFilter = 'open' | 'accepted_without_job' | 'sent_older_5d'
export type JobModuleFilter =
  | 'scheduled'
  | 'completed_without_invoice'
  | 'completed_without_invoice_2d'
  | 'today'
  | 'tomorrow'
  | 'upcoming'
export type ExpenseModuleFilter = 'missing_receipt' | 'current_month'
export type PaymentModuleFilter = 'current_month'

function getMonthKey(dateValue: string): string | null {
  if (!dateValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getDateValue(dateValue: string): Date | null {
  if (!dateValue) return null
  const normalizedValue = dateValue.length > 10 ? dateValue : `${dateValue}T00:00:00`
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateKey(dateValue: string): string | null {
  const date = getDateValue(dateValue)
  if (!date) return null
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
  const date = getDateValue(dateValue)
  if (!date) return false
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - days)
  return date < threshold
}

export interface ModuleFilterState {
  invoices: InvoiceModuleFilter | null
  quotes: QuoteModuleFilter | null
  jobs: JobModuleFilter | null
  expenses: ExpenseModuleFilter | null
  payments: PaymentModuleFilter | null
}

export const emptyModuleFilterState: ModuleFilterState = {
  invoices: null,
  quotes: null,
  jobs: null,
  expenses: null,
  payments: null,
}

export function getInvoiceFilterLabel(filter: InvoiceModuleFilter | null): string | null {
  if (filter === 'pending') return 'Pendientes de cobro'
  if (filter === 'current_month') return 'Facturas emitidas este mes'
  if (filter === 'unpaid_older_7d') return 'Facturas pendientes con más de 7 días'
  return null
}

export function getQuoteFilterLabel(filter: QuoteModuleFilter | null): string | null {
  if (filter === 'open') return 'Presupuestos abiertos'
  if (filter === 'accepted_without_job') return 'Presupuestos aceptados sin trabajo'
  if (filter === 'sent_older_5d') return 'Presupuestos enviados con más de 5 días'
  return null
}

export function getJobFilterLabel(filter: JobModuleFilter | null): string | null {
  if (filter === 'scheduled') return 'Servicios programados o en curso'
  if (filter === 'completed_without_invoice') return 'Servicios completados sin factura'
  if (filter === 'completed_without_invoice_2d') return 'Servicios completados sin factura con más de 2 días'
  if (filter === 'today') return 'Servicios programados para hoy'
  if (filter === 'tomorrow') return 'Servicios programados para mañana'
  if (filter === 'upcoming') return 'Próximos servicios programados'
  return null
}

export function getExpenseFilterLabel(filter: ExpenseModuleFilter | null): string | null {
  if (filter === 'missing_receipt') return 'Sin ticket o factura adjunta'
  if (filter === 'current_month') return 'Gastos del mes'
  return null
}

export function getPaymentFilterLabel(filter: PaymentModuleFilter | null): string | null {
  if (filter === 'current_month') return 'Cobros del mes'
  return null
}

export function applyInvoiceFilter(invoices: InvoiceListItem[], filter: InvoiceModuleFilter | null): InvoiceListItem[] {
  if (filter === 'pending') {
    return invoices.filter((invoice) => invoice.status !== 'paid')
  }

  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return invoices.filter((invoice) => getMonthKey(invoice.issue_date) === currentMonthKey)
  }

  if (filter === 'unpaid_older_7d') {
    return invoices.filter((invoice) => invoice.status !== 'paid' && isOlderThanDays(invoice.issue_date, 7))
  }

  return invoices
}

export function applyQuoteFilter(quotes: QuoteListItem[], filter: QuoteModuleFilter | null): QuoteListItem[] {
  if (filter === 'open') {
    return quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent')
  }

  if (filter === 'accepted_without_job') {
    return quotes.filter((quote) => quote.status === 'accepted' && !quote.job_id)
  }

  if (filter === 'sent_older_5d') {
    return quotes.filter((quote) => quote.status === 'sent' && isOlderThanDays(quote.created_at ?? '', 5))
  }

  return quotes
}

export function applyJobFilter(jobs: JobListItem[], filter: JobModuleFilter | null): JobListItem[] {
  if (filter === 'scheduled') {
    return jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress')
  }

  if (filter === 'completed_without_invoice') {
    return jobs.filter((job) => job.status === 'completed' && !job.invoice_id)
  }

  if (filter === 'completed_without_invoice_2d') {
    return jobs.filter((job) => job.status === 'completed' && !job.invoice_id && isOlderThanDays(job.scheduled_date, 2))
  }

  if (filter === 'today') {
    const todayKey = createDayKey(0)
    return jobs.filter((job) => getDateKey(job.scheduled_date) === todayKey && job.status !== 'cancelled')
  }

  if (filter === 'tomorrow') {
    const tomorrowKey = createDayKey(1)
    return jobs.filter((job) => getDateKey(job.scheduled_date) === tomorrowKey && job.status !== 'cancelled')
  }

  if (filter === 'upcoming') {
    const tomorrowKey = createDayKey(1)
    return jobs.filter((job) => {
      const jobDate = getDateValue(job.scheduled_date)
      const tomorrowDate = getDateValue(tomorrowKey)
      if (!jobDate || !tomorrowDate) return false
      return jobDate > tomorrowDate && job.status !== 'completed' && job.status !== 'cancelled'
    })
  }

  return jobs
}

export function applyExpenseFilter(expenses: ExpenseListItem[], filter: ExpenseModuleFilter | null): ExpenseListItem[] {
  if (filter === 'missing_receipt') {
    return expenses.filter((expense) => !expense.receipt_file_path || expense.document_support_status === 'missing')
  }

  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return expenses.filter((expense) => getMonthKey(expense.expense_date) === currentMonthKey)
  }

  return expenses
}

export function applyPaymentFilter(payments: PaymentListItem[], filter: PaymentModuleFilter | null): PaymentListItem[] {
  if (filter === 'current_month') {
    const currentMonthKey = getCurrentMonthKey()
    return payments.filter((payment) => getMonthKey(payment.payment_date) === currentMonthKey)
  }

  return payments
}
