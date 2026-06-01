import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'

export interface ClientRelationshipSummary {
  propertiesCount: number
  jobsCount: number
  activeJobsCount: number
  completedJobsCount: number
  quotesCount: number
  openQuotesCount: number
  acceptedQuotesCount: number
  invoicesCount: number
}

export interface PropertyRelationshipSummary {
  jobsCount: number
  activeJobsCount: number
  completedJobsCount: number
  quotesCount: number
  openQuotesCount: number
  acceptedQuotesCount: number
  invoicesCount: number
}

export function buildClientRelationshipSummary(
  clientId: string,
  properties: PropertyListItem[],
  jobs: JobListItem[],
  quotes: QuoteListItem[],
  invoices: InvoiceListItem[],
): ClientRelationshipSummary {
  const relatedJobs = jobs.filter((job) => job.client_id === clientId)
  const relatedQuotes = quotes.filter((quote) => quote.client_id === clientId)

  return {
    propertiesCount: properties.filter((property) => property.client_id === clientId).length,
    jobsCount: relatedJobs.length,
    activeJobsCount: relatedJobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled').length,
    completedJobsCount: relatedJobs.filter((job) => job.status === 'completed').length,
    quotesCount: relatedQuotes.length,
    openQuotesCount: relatedQuotes.filter((quote) => quote.status !== 'accepted').length,
    acceptedQuotesCount: relatedQuotes.filter((quote) => quote.status === 'accepted').length,
    invoicesCount: invoices.filter((invoice) => invoice.client_id === clientId).length,
  }
}

export function buildPropertyRelationshipSummary(
  propertyId: string,
  jobs: JobListItem[],
  quotes: QuoteListItem[],
  invoices: InvoiceListItem[],
): PropertyRelationshipSummary {
  const relatedJobs = jobs.filter((job) => job.property_id === propertyId)
  const relatedQuotes = quotes.filter((quote) => quote.property_id === propertyId)

  return {
    jobsCount: relatedJobs.length,
    activeJobsCount: relatedJobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled').length,
    completedJobsCount: relatedJobs.filter((job) => job.status === 'completed').length,
    quotesCount: relatedQuotes.length,
    openQuotesCount: relatedQuotes.filter((quote) => quote.status !== 'accepted').length,
    acceptedQuotesCount: relatedQuotes.filter((quote) => quote.status === 'accepted').length,
    invoicesCount: invoices.filter((invoice) => invoice.property_id === propertyId).length,
  }
}
