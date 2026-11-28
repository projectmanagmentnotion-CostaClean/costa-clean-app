import type { InvoiceListItem } from '../invoices/types'

/** Fiscal revenue includes issued invoices only. Draft, cancelled, archived,
 * and deleted invoices remain operational records and do not contribute to
 * fiscal close totals.
 */
export function isFiscalInvoiceIncluded(invoice: InvoiceListItem): boolean {
  return (invoice.status === 'sent' || invoice.status === 'issued' || invoice.status === 'paid')
    && !invoice.cancelled_at
    && !invoice.archived_at
    && !invoice.deleted_at
}
