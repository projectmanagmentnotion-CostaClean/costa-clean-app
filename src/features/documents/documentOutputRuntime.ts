import type { InvoiceListItem } from '../invoices/types'
import type { PropertyListItem } from '../properties/types'
import type { ClientListItem } from '../clients/types'
import type { QuoteOutputIntent } from '../quotes/openQuotePrintWindow'
import type { QuoteListItem } from '../quotes/types'
import type { InvoiceDocumentOutputIntent } from '../invoices/invoicePdfOutput'

export async function openInvoiceDocumentOutput(
  invoice: InvoiceListItem,
  intent: InvoiceDocumentOutputIntent = 'print',
) {
  const { openInvoiceDocumentOutput: runInvoiceDocumentOutput } = await import('../invoices/invoicePdfOutput')
  return runInvoiceDocumentOutput(invoice, intent)
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
