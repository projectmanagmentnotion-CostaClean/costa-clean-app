import type { JobListItem } from '../jobs/types'
import type { InvoiceListItem } from './types'

type InvoiceJobLink = Pick<InvoiceListItem, 'job_id' | 'status' | 'archived_at' | 'deleted_at' | 'cancelled_at'>

/** Keep the invoice selector aligned with save_invoice_business_graph's EXISTING_JOB contract. */
export function isJobAvailableForInvoiceLink(
  job: JobListItem,
  clientId?: string | null,
  propertyId?: string | null,
  invoices: readonly InvoiceJobLink[] = [],
): boolean {
  if (clientId && job.client_id !== clientId) return false
  if (propertyId && job.property_id !== propertyId) return false
  const hasActiveLinkedInvoice = invoices.some((invoice) => (
    invoice.job_id === job.id
      && invoice.status !== 'cancelled'
      && !invoice.archived_at
      && !invoice.deleted_at
      && !invoice.cancelled_at
  ))
  if (job.invoice_id || hasActiveLinkedInvoice || job.deleted_at || job.archived_at || job.cancelled_at) return false
  return job.status !== 'cancelled' && job.status !== 'completed'
}

export function isJobAvailableForQuoteInvoiceLink(
  job: JobListItem,
  quoteId: string | null | undefined,
  clientId?: string | null,
  propertyId?: string | null,
  invoices: readonly InvoiceJobLink[] = [],
): boolean {
  return isJobAvailableForInvoiceLink(job, clientId, propertyId, invoices)
    && (!job.quote_id || job.quote_id === quoteId)
}
