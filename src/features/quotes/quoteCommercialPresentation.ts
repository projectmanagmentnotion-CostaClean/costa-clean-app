import { businessRules } from '../../app/businessRules'
import { formatCurrency } from '../../app/displayFormat'

interface QuoteCommercialAmountOptions {
  subtotal: number
  taxAmount: number
  total: number
}

export function getQuoteCustomerFacingTotalValue({
  subtotal,
  total,
}: Pick<QuoteCommercialAmountOptions, 'subtotal' | 'total'>): number {
  return businessRules.quotesIncludeTaxByDefault ? total : subtotal
}

export function getQuoteCustomerFacingTotalLabel(): string {
  return businessRules.quotesIncludeTaxByDefault ? 'Total estimado' : 'Total final'
}

export function getQuoteCustomerFacingTotalNote(): string {
  return businessRules.quotesIncludeTaxByDefault
    ? 'Importe final estimado para compartir con el cliente.'
    : businessRules.defaultQuoteLegalNote
}

export function getQuoteTaxReferenceLabel(): string {
  return businessRules.quotesIncludeTaxByDefault
    ? `IVA (${Math.round(businessRules.defaultTaxRate * 100)}%)`
    : 'Referencia IVA'
}

export function getQuoteTaxReferenceNote(): string {
  return businessRules.quotesIncludeTaxByDefault
    ? 'Incluido en el total final mostrado.'
    : 'Dato interno de referencia. No se suma al total comercial.'
}

export function formatQuoteCustomerFacingTotal({
  subtotal,
  total,
}: Pick<QuoteCommercialAmountOptions, 'subtotal' | 'total'>): string {
  return formatCurrency(getQuoteCustomerFacingTotalValue({ subtotal, total }))
}

export function getQuoteCommercialSummary({
  subtotal,
  taxAmount,
  total,
}: QuoteCommercialAmountOptions) {
  return {
    subtotalLabel: 'Base comercial',
    subtotalValue: formatCurrency(subtotal),
    taxLabel: getQuoteTaxReferenceLabel(),
    taxValue: formatCurrency(taxAmount),
    taxNote: getQuoteTaxReferenceNote(),
    totalLabel: getQuoteCustomerFacingTotalLabel(),
    totalValue: formatQuoteCustomerFacingTotal({ subtotal, total }),
    totalNote: getQuoteCustomerFacingTotalNote(),
  }
}
