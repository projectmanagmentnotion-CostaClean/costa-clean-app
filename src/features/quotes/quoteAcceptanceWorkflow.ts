import { acceptQuoteWorkflow } from '../financial/financialWriteApi'
import type { QuoteListItem } from './types'
import { createLocalId } from './quoteLineUtils'

export interface QuoteAcceptanceResult {
  quoteId: string
  invoiceId: string | null
  clientId: string
  clientAction: string
  leadId: string | null
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mapAcceptanceResult(result: Awaited<ReturnType<typeof acceptQuoteWorkflow>>): QuoteAcceptanceResult {
  return {
    quoteId: result.quote_id,
    invoiceId: result.invoice_id,
    clientId: result.client_id,
    clientAction: result.client_action,
    leadId: result.lead_id,
  }
}

export async function acceptQuoteOnly(quote: QuoteListItem): Promise<QuoteAcceptanceResult> {
  if (quote.status === 'accepted') {
    throw new Error('Este presupuesto ya esta aceptado.')
  }

  const result = await acceptQuoteWorkflow({
    quoteId: quote.id,
    createInvoice: false,
  })

  return mapAcceptanceResult(result)
}

export async function acceptQuoteAndCreateInvoice(
  quote: QuoteListItem,
): Promise<QuoteAcceptanceResult> {
  if (quote.status === 'accepted') {
    throw new Error('Este presupuesto ya esta aceptado.')
  }

  const result = await acceptQuoteWorkflow({
    quoteId: quote.id,
    createInvoice: true,
    invoiceId: createLocalId('INVOICE'),
    issueDate: todayLocalDate(),
  })

  return mapAcceptanceResult(result)
}
