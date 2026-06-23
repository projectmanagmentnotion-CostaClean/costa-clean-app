import type { InvoiceOutputIntent } from '../invoices/openInvoicePrintWindow'
import type { InvoiceListItem } from '../invoices/types'
import type { PropertyListItem } from '../properties/types'
import type { ClientListItem } from '../clients/types'
import type { QuoteOutputIntent } from '../quotes/openQuotePrintWindow'
import type { QuoteListItem } from '../quotes/types'

export async function openInvoiceDocumentOutput(
  invoice: InvoiceListItem,
  intent: InvoiceOutputIntent = 'print',
) {
  const { openInvoicePrintWindow } = await import('../invoices/openInvoicePrintWindow')
  openInvoicePrintWindow(invoice, intent)
}

export async function openQuoteDocumentOutput(
  quote: QuoteListItem,
  clients: ClientListItem[],
  properties: PropertyListItem[],
  intent: QuoteOutputIntent = 'print',
) {
  const { openQuotePrintWindow } = await import('../quotes/openQuotePrintWindow')
  openQuotePrintWindow(quote, clients, properties, intent)
}
