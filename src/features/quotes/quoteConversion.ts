import { acceptQuoteWorkflow } from '../financial/financialWriteApi'
import type { InvoiceListItem } from '../invoices/types'
import type { QuoteListItem } from './types'

export function canConvertQuoteToInvoice(quote: QuoteListItem, invoices: InvoiceListItem[] = []): boolean {
  const activeInvoice = invoices.some((invoice) => invoice.quote_id === quote.id && invoice.status !== 'cancelled' && !invoice.cancelled_at)
  const lines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
  return Boolean(
    !quote.archived_at
    && !quote.deleted_at
    && !quote.invoice_id
    && !activeInvoice
    && ['draft', 'sent', 'accepted'].includes(quote.status)
    && (quote.client_id || quote.lead_id)
    && lines.length > 0,
  )
}

export async function convertQuoteToInvoice(quote: QuoteListItem): Promise<string> {
  const result = await acceptQuoteWorkflow({
    quoteId: quote.id,
    createInvoice: true,
    invoiceId: null,
    issueDate: new Date().toISOString().slice(0, 10),
  })
  if (!result.invoice_id) throw new Error('La conversión terminó sin devolver una factura confirmada.')
  return result.invoice_id
}
