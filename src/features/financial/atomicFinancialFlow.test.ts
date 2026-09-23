import { describe, expect, it } from 'vitest'
import { buildAtomicOperationPayload, createAtomicFlowDraft, mapAtomicFinancialError } from './atomicFinancialFlow'

describe('N3 atomic financial flow contract', () => {
  it('keeps one idempotency key across payload rebuilds', () => {
    const draft = createAtomicFlowDraft(() => 'stable-key')
    const first = buildAtomicOperationPayload({ ...draft, clientId: 'client-1', propertyId: 'property-1', concept: 'Limpieza', unitPrice: 100 })
    const second = buildAtomicOperationPayload({ ...draft, clientId: 'client-1', propertyId: 'property-1', concept: 'Limpieza', unitPrice: 100 })
    expect(first.idempotencyKey).toBe('stable-key')
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  it('builds service, invoice and optional payment payloads', () => {
    const draft = createAtomicFlowDraft(() => 'key')
    const withoutPayment = buildAtomicOperationPayload({ ...draft, clientId: 'client-1', propertyId: 'property-1', concept: 'Servicio', unitPrice: 100, taxAmount: 21 })
    const withPayment = buildAtomicOperationPayload({ ...draft, clientId: 'client-1', propertyId: 'property-1', concept: 'Servicio', unitPrice: 100, taxAmount: 21, paymentEnabled: true, paymentAmount: 121 })
    expect(withoutPayment.job.client_id).toBe('client-1')
    expect(withoutPayment.invoice.total).toBe(121)
    expect(withoutPayment.payment).toBeNull()
    expect(withPayment.payment?.invoice_id).toBe(withPayment.invoice.id)
  })

  it('maps known and unknown server errors safely', () => {
    expect(mapAtomicFinancialError(new Error('property_client_mismatch'))).toContain('propiedad')
    expect(mapAtomicFinancialError(new Error('unexpected_failure'))).toContain('borrador')
  })
})
