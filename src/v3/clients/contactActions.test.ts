import { describe, expect, it } from 'vitest'
import { buildMailtoUrl, buildTelUrl, buildWhatsAppUrl, normalizeContactPhone } from './contactActions'

describe('V3 client contact actions', () => {
  it('normalizes unambiguous Spanish national numbers', () => {
    expect(normalizeContactPhone('600 123 456')).toBe('+34600123456')
    expect(buildTelUrl('600 123 456')).toBe('tel:+34600123456')
  })

  it('builds safe WhatsApp links without delivery claims', () => {
    expect(buildWhatsAppUrl('+34 600 123 456', { text: 'Hola Elena' })).toBe('https://wa.me/34600123456?text=Hola%20Elena')
    expect(buildWhatsAppUrl('not-a-phone')).toBeNull()
  })

  it('guards email and preserves optional context', () => {
    expect(buildMailtoUrl('elena@example.com', { subject: 'Costa Clean' })).toBe('mailto:elena@example.com?subject=Costa+Clean')
    expect(buildMailtoUrl('invalid')).toBeNull()
  })
})
