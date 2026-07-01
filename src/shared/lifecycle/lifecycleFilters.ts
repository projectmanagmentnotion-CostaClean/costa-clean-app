import type { ClientListItem } from '../../features/clients/types'
import type { ExpenseListItem } from '../../features/expenses/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { LeadListItem } from '../../features/leads/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { isActiveForDefaultView, isArchivedEntity, isCancelledEntity, isDeletedEntity } from './entityLifecycle'

export function filterActiveJobs(jobs: JobListItem[]): JobListItem[] {
  return jobs.filter((job) => isActiveForDefaultView('job', job))
}

export function filterActiveInvoices(invoices: InvoiceListItem[]): InvoiceListItem[] {
  return invoices.filter((invoice) => isActiveForDefaultView('invoice', invoice))
}

export function filterActiveQuotes(quotes: QuoteListItem[]): QuoteListItem[] {
  return quotes.filter((quote) => isActiveForDefaultView('quote', quote))
}

export function filterActiveExpenses(expenses: ExpenseListItem[]): ExpenseListItem[] {
  return expenses.filter((expense) => isActiveForDefaultView('expense', expense))
}

export function filterActiveClients(clients: ClientListItem[]): ClientListItem[] {
  return clients.filter((client) => isActiveForDefaultView('client', client))
}

export function filterActiveProperties(properties: PropertyListItem[]): PropertyListItem[] {
  return properties.filter((property) => isActiveForDefaultView('property', property))
}

export function filterActiveLeads(leads: LeadListItem[]): LeadListItem[] {
  return leads.filter((lead) => isActiveForDefaultView('lead', lead))
}

export function isInvoiceVisibleInPendingCollections(invoice: InvoiceListItem): boolean {
  return !isArchivedEntity(invoice) && !isDeletedEntity(invoice) && !isCancelledEntity(invoice)
}
