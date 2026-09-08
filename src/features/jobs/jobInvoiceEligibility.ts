import type { InvoiceListItem } from '../invoices/types'
import type { JobListItem } from './types'

export function canCreateInvoiceFromJob(job: JobListItem, invoices: InvoiceListItem[]): boolean {
  if (!job.id || job.status !== 'completed' || job.archived_at || job.deleted_at || job.cancelled_at) return false
  return !invoices.some((invoice) => !invoice.deleted_at && !invoice.archived_at && invoice.status !== 'cancelled' && (invoice.job_id === job.id || invoice.id === job.invoice_id))
}
