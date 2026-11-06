import type { InvoiceListItem } from './types'

export function resolveInvoiceServiceReference(
  invoice: Pick<InvoiceListItem, 'service_reference_override' | 'service_reference' | 'service_description' | 'billing_concept' | 'quote_display_code' | 'job_display_code' | 'job_id'>,
  emptyFallback = 'Servicio realizado',
): string {
  return invoice.service_reference_override?.trim()
    || invoice.service_reference?.trim()
    || invoice.service_description?.trim()
    || invoice.billing_concept?.trim()
    || invoice.quote_display_code?.trim()
    || invoice.job_display_code?.trim()
    || invoice.job_id?.trim()
    || emptyFallback
}
