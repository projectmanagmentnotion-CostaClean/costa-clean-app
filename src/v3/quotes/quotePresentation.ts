import type { InvoiceListItem } from '../../features/invoices/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { canConvertQuoteToInvoice } from '../../features/quotes/quoteConversion'

export interface QuoteFinancialFacts {
  subtotal: number
  tax: number
  total: number
}

export interface QuoteConversionPresentation {
  available: boolean
  actionLabel: string
  description: string
  unavailableMessage: string | null
}

export function getQuoteFinancialFacts(quote: QuoteListItem): QuoteFinancialFacts {
  return {
    subtotal: Number(quote.subtotal ?? 0),
    tax: Number(quote.tax_amount ?? 0),
    total: Number(quote.total ?? 0),
  }
}

function hasLinkedInvoice(quote: QuoteListItem, invoices: InvoiceListItem[]) {
  return Boolean(quote.invoice_id) || invoices.some((invoice) => invoice.quote_id === quote.id && invoice.status !== 'cancelled' && !invoice.cancelled_at)
}

export function getQuoteConversionPresentation(quote: QuoteListItem, invoices: InvoiceListItem[]): QuoteConversionPresentation {
  const alreadyAccepted = quote.status === 'accepted'
  const actionLabel = alreadyAccepted ? 'Crear factura vinculada' : 'Aceptar y crear factura'

  if (canConvertQuoteToInvoice(quote, invoices)) {
    return {
      available: true,
      actionLabel,
      description: alreadyAccepted
        ? 'Se creará una factura real vinculada a este presupuesto con sus líneas e importes actuales. No se realizará ningún cambio hasta confirmar.'
        : 'Se aceptará este presupuesto y se creará una factura real vinculada con sus líneas e importes actuales. No se realizará ningún cambio hasta confirmar.',
      unavailableMessage: null,
    }
  }

  if (hasLinkedInvoice(quote, invoices)) {
    return { available: false, actionLabel, description: '', unavailableMessage: 'Ya existe una factura vinculada a este presupuesto.' }
  }
  if (quote.archived_at || quote.deleted_at || quote.status === 'archived') {
    return { available: false, actionLabel, description: '', unavailableMessage: 'Este presupuesto está archivado y no puede convertirse.' }
  }
  if (quote.status === 'rejected' || quote.status === 'expired') {
    return { available: false, actionLabel, description: '', unavailableMessage: 'Este presupuesto no está disponible para crear una factura.' }
  }
  if (!quote.client_id && !quote.lead_id) {
    return { available: false, actionLabel, description: '', unavailableMessage: 'Falta el cliente o lead necesario para crear una factura vinculada.' }
  }
  return { available: false, actionLabel, description: '', unavailableMessage: 'Este presupuesto todavía no cumple los requisitos para crear una factura.' }
}
