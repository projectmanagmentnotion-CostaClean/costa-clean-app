import { describe, expect, it } from 'vitest'
import { invoiceDisplayCode, relatedDisplayCode } from './finance/selectorDisplayCodes'

const internalId = 'a2b4c6d8-1111-2222-3333-444444444444'

describe('V3 finance human-readable selector fallbacks', () => {
  it('uses human-readable fallbacks instead of internal UUIDs for services, quotes and invoices', () => {
    expect(relatedDisplayCode(internalId, 'Servicio sin código')).toBe('Servicio sin código')
    expect(relatedDisplayCode(internalId, 'Presupuesto sin código')).toBe('Presupuesto sin código')
    expect(invoiceDisplayCode(internalId, internalId)).toBe('Factura sin referencia')
  })

  it('preserves public invoice identifiers when they are available', () => {
    expect(relatedDisplayCode('JOB-2026-001', 'Servicio sin código')).toBe('JOB-2026-001')
    expect(invoiceDisplayCode('INV-2026-001', internalId)).toBe('INV-2026-001')
    expect(invoiceDisplayCode(internalId, '2026-001')).toBe('2026-001')
  })
})
