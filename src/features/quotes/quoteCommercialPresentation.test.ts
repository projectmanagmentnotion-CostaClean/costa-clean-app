import { describe, expect, it } from 'vitest'
import {
  getQuoteCommercialSummary,
  getQuoteCustomerFacingTotalLabel,
  getQuoteCustomerFacingTotalNote,
  getQuoteCustomerFacingTotalValue,
  getQuoteTaxReferenceLabel,
  getQuoteTaxReferenceNote,
} from './quoteCommercialPresentation'

describe('quoteCommercialPresentation', () => {
  it('presents zero-VAT quotes as final price without VAT', () => {
    expect(getQuoteCustomerFacingTotalValue({ subtotal: 3978, taxAmount: 0, total: 3978 })).toBe(3978)
    expect(getQuoteCustomerFacingTotalLabel(0)).toBe('Total final')
    expect(getQuoteCustomerFacingTotalNote(0)).toBe('Los precios indicados no incluyen IVA.')
    expect(getQuoteTaxReferenceLabel(0)).toBe('Referencia IVA')
    expect(getQuoteTaxReferenceNote(0)).toBe('Dato interno de referencia. No se suma al total comercial.')

    expect(getQuoteCommercialSummary({
      subtotal: 3978,
      taxAmount: 0,
      total: 3978,
    })).toMatchObject({
      subtotalLabel: 'Base comercial',
      subtotalValue: '3978,00 €',
      taxLabel: 'Referencia IVA',
      taxValue: '0,00 €',
      taxNote: 'Dato interno de referencia. No se suma al total comercial.',
      totalLabel: 'Total final',
      totalValue: '3978,00 €',
      totalNote: 'Los precios indicados no incluyen IVA.',
    })
  })

  it('still reflects tax-inclusive quotes when tax is present', () => {
    expect(getQuoteCustomerFacingTotalValue({ subtotal: 100, taxAmount: 21, total: 121 })).toBe(121)
    expect(getQuoteCustomerFacingTotalLabel(21)).toBe('Total estimado')
    expect(getQuoteCustomerFacingTotalNote(21)).toBe('Importe final estimado para compartir con el cliente.')
    expect(getQuoteTaxReferenceLabel(21)).toBe('IVA (21%)')
    expect(getQuoteTaxReferenceNote(21)).toBe('Incluido en el total final mostrado.')
  })
})
