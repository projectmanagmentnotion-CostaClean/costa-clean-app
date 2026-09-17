import { describe, expect, it } from 'vitest'
import { filterPaymentsByOrigin, getPaymentProvenancePresentation } from './paymentPresentation'

describe('getPaymentProvenancePresentation', () => {
  it('describes transfer automation as provenance rather than reconciliation', () => {
    const presentation = getPaymentProvenancePresentation('transfer_auto')
    expect(presentation.label).toBe('Información automática de transferencia')
    expect(presentation.description).toContain('No confirma conciliación')
    expect(presentation.editable).toBe(false)
  })

  it('keeps manual records editable and historical transfer records read-only', () => {
    expect(getPaymentProvenancePresentation('manual').editable).toBe(true)
    expect(getPaymentProvenancePresentation('transfer_regularization').editable).toBe(false)
  })

  it('filters only existing origin values without assigning a new finance state', () => {
    const payments = [
      { id: 'manual', origin_type: 'manual' },
      { id: 'automatic', origin_type: 'transfer_auto' },
      { id: 'historical', origin_type: 'transfer_regularization' },
    ]
    expect(filterPaymentsByOrigin(payments, 'transfer_auto').map((payment) => payment.id)).toEqual(['automatic'])
    expect(filterPaymentsByOrigin(payments, 'manual').map((payment) => payment.id)).toEqual(['manual'])
    expect(filterPaymentsByOrigin(payments, 'all')).toEqual(payments)
  })
})
