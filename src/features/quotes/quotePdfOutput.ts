import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { deliverPdfFile } from '../documents/documentFileDelivery'
import type { QuoteListItem } from './types'
import { renderQuoteDocumentPdf } from './quoteDomPdfExport'

function getClientName(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim()
    || quote.client_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Cliente'
}

function sanitizeFileNamePart(value: string): string {
  let sanitized = ''

  for (const char of value.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0
    if ('\\/:*?"<>|'.includes(char) || code <= 31) continue
    sanitized += char
  }

  return sanitized.replace(/\s+/g, ' ').trim()
}

export function buildQuotePdfFileName(quote: QuoteListItem, clients: ClientListItem[]): string {
  const reference = sanitizeFileNamePart(quote.display_code ?? quote.id)
  const client = sanitizeFileNamePart(getClientName(quote, clients))
  return `${[reference, client, 'Presupuesto CostaClean'].filter(Boolean).join(' - ') || 'Presupuesto CostaClean'}.pdf`
}

export async function buildQuotePdfBlob(
  quote: QuoteListItem,
  clients: ClientListItem[],
  properties: PropertyListItem[],
): Promise<Blob> {
  return renderQuoteDocumentPdf(quote, clients, properties)
}

export async function downloadQuotePdf(
  quote: QuoteListItem,
  clients: ClientListItem[],
  properties: PropertyListItem[],
) {
  const blob = await buildQuotePdfBlob(quote, clients, properties)
  const fileName = buildQuotePdfFileName(quote, clients)
  const file = typeof File !== 'undefined'
    ? new File([blob], fileName, { type: 'application/pdf' })
    : blob as File

  return deliverPdfFile(file, fileName)
}
