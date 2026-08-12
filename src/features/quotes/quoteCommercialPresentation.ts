import { businessRules } from '../../app/businessRules'
import { formatCurrency } from '../../app/displayFormat'

interface QuoteCommercialAmountOptions {
  subtotal: number
  taxAmount: number
  total: number
}

export function getQuoteCustomerFacingTotalValue({
  subtotal,
  taxAmount,
  total,
}: Pick<QuoteCommercialAmountOptions, 'subtotal' | 'taxAmount' | 'total'>): number {
  return taxAmount > 0 ? total : subtotal
}

export function getQuoteCustomerFacingTotalLabel(taxAmount = 0): string {
  return taxAmount > 0 ? 'Total estimado' : 'Total final'
}

export function getQuoteCustomerFacingTotalNote(taxAmount = 0): string {
  return taxAmount > 0
    ? 'Importe final estimado para compartir con el cliente.'
    : businessRules.defaultQuoteLegalNote
}

export function getQuoteTaxReferenceLabel(taxAmount = 0): string {
  return taxAmount > 0
    ? `IVA (${Math.round(businessRules.defaultTaxRate * 100)}%)`
    : 'Referencia IVA'
}

export function getQuoteTaxReferenceNote(taxAmount = 0): string {
  return taxAmount > 0
    ? 'Incluido en el total final mostrado.'
    : 'Dato interno de referencia. No se suma al total comercial.'
}

export function formatQuoteCustomerFacingTotal({
  subtotal,
  taxAmount,
  total,
}: Pick<QuoteCommercialAmountOptions, 'subtotal' | 'taxAmount' | 'total'>): string {
  return formatCurrency(getQuoteCustomerFacingTotalValue({ subtotal, taxAmount, total }))
}

export function getQuoteCommercialSummary({
  subtotal,
  taxAmount,
  total,
}: QuoteCommercialAmountOptions) {
  return {
    subtotalLabel: 'Base comercial',
    subtotalValue: formatCurrency(subtotal),
    taxLabel: getQuoteTaxReferenceLabel(taxAmount),
    taxValue: formatCurrency(taxAmount),
    taxNote: getQuoteTaxReferenceNote(taxAmount),
    totalLabel: getQuoteCustomerFacingTotalLabel(taxAmount),
    totalValue: formatQuoteCustomerFacingTotal({ subtotal, taxAmount, total }),
    totalNote: getQuoteCustomerFacingTotalNote(taxAmount),
  }
}
