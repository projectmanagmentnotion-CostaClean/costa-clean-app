import { formatMoneyInput, formatQuantityInput } from '../shared/billingLineDrafts'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import type { InvoiceListItem } from './types'

function createPrefillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `invoice-prefill-${Date.now()}`
}

export function buildInvoiceCreatePrefillFromInvoice(invoice: InvoiceListItem): InvoiceCreatePrefill {
  const persistedLines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []

  return {
    request_id: createPrefillId(),
    origin_kind: 'manual',
    job_id: '',
    quote_id: '',
    client_id: invoice.client_id,
    property_id: invoice.property_id ?? '',
    notes: invoice.notes?.trim() || '',
    lines: persistedLines.map((line) => ({
      concept: line.concept,
      quantity: formatQuantityInput(line.quantity),
      unit: line.unit?.trim() || 'servicio',
      unit_price: formatMoneyInput(line.unit_price),
    })),
    title: invoice.invoice_number ?? invoice.display_code ?? invoice.id,
  }
}
