import type { JobListItem } from '../jobs/types'

/** Keep the invoice selector aligned with save_invoice_business_graph's EXISTING_JOB contract. */
export function isJobAvailableForInvoiceLink(
  job: JobListItem,
  clientId?: string | null,
  propertyId?: string | null,
): boolean {
  if (clientId && job.client_id !== clientId) return false
  if (propertyId && job.property_id !== propertyId) return false
  if (job.invoice_id || job.deleted_at || job.archived_at || job.cancelled_at) return false
  return job.status !== 'cancelled' && job.status !== 'completed'
}
