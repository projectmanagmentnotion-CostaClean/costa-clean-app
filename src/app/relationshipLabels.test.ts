import { describe, expect, it } from 'vitest'
import { formatClientLabel, formatInvoiceLabel, isTechnicalUuid, toUserFacingReference } from './relationshipLabels'

const uuid = 'e1643c33-ae20-48cd-a2c7-99fd41184533'

describe('user-facing relationship labels', () => {
  it('recognises canonical UUIDs without changing internal values', () => {
    expect(isTechnicalUuid(uuid)).toBe(true)
    expect(toUserFacingReference(uuid)).toBeNull()
    expect(toUserFacingReference('INV-0042')).toBe('INV-0042')
  })

  it('does not expose an invoice UUID when human references are absent', () => {
    expect(formatInvoiceLabel({ id: uuid, client_id: uuid })).toBe('Factura sin referencia')
    expect(formatInvoiceLabel({ id: uuid, invoice_number: '2026-045' })).toBe('2026-045')
  })

  it('preserves human invoice and client references', () => {
    expect(formatInvoiceLabel({ id: uuid, display_code: 'INV-0042', invoice_number: '2026-045', client_name: 'Hotel Las Vegas' })).toBe('INV-0042 - 2026-045 - Hotel Las Vegas')
    expect(formatClientLabel({ id: uuid, full_name: 'Hotel Las Vegas' })).toBe('Hotel Las Vegas')
    expect(formatClientLabel({ id: uuid, display_code: 'CLIENT-0012', full_name: 'Hotel Las Vegas' })).toBe('CLIENT-0012 - Hotel Las Vegas')
  })
})
