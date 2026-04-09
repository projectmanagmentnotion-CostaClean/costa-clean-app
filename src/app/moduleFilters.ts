import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'

export type InvoiceModuleFilter = 'pending'
export type QuoteModuleFilter = 'open'
export type JobModuleFilter = 'scheduled'
export type ExpenseModuleFilter = 'missing_receipt'

export interface ModuleFilterState {
  invoices: InvoiceModuleFilter | null
  quotes: QuoteModuleFilter | null
  jobs: JobModuleFilter | null
  expenses: ExpenseModuleFilter | null
}

export const emptyModuleFilterState: ModuleFilterState = {
  invoices: null,
  quotes: null,
  jobs: null,
  expenses: null,
}

export function getInvoiceFilterLabel(filter: InvoiceModuleFilter | null): string | null {
  if (filter === 'pending') return 'Pendientes de cobro'
  return null
}

export function getQuoteFilterLabel(filter: QuoteModuleFilter | null): string | null {
  if (filter === 'open') return 'Presupuestos abiertos'
  return null
}

export function getJobFilterLabel(filter: JobModuleFilter | null): string | null {
  if (filter === 'scheduled') return 'Servicios programados o en curso'
  return null
}

export function getExpenseFilterLabel(filter: ExpenseModuleFilter | null): string | null {
  if (filter === 'missing_receipt') return 'Sin ticket o factura adjunta'
  return null
}

export function applyInvoiceFilter(invoices: InvoiceListItem[], filter: InvoiceModuleFilter | null): InvoiceListItem[] {
  if (filter === 'pending') {
    return invoices.filter((invoice) => invoice.status !== 'paid')
  }

  return invoices
}

export function applyQuoteFilter(quotes: QuoteListItem[], filter: QuoteModuleFilter | null): QuoteListItem[] {
  if (filter === 'open') {
    return quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent')
  }

  return quotes
}

export function applyJobFilter(jobs: JobListItem[], filter: JobModuleFilter | null): JobListItem[] {
  if (filter === 'scheduled') {
    return jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress')
  }

  return jobs
}

export function applyExpenseFilter(expenses: ExpenseListItem[], filter: ExpenseModuleFilter | null): ExpenseListItem[] {
  if (filter === 'missing_receipt') {
    return expenses.filter((expense) => !expense.receipt_file_path || expense.document_support_status === 'missing')
  }

  return expenses
}
