import { describe, expect, it } from 'vitest'
import { resolveInvoiceServiceReference } from './invoiceServiceReference'

describe('resolveInvoiceServiceReference', () => {
  it('uses the trimmed dedicated override exactly when it is non-empty', () => {
    expect(resolveInvoiceServiceReference({
      service_reference_override: '  Ayudante de buffet  ',
      service_reference: 'JOB-077 · Limpieza · Piso',
      service_description: 'Servicio de limpieza',
      quote_display_code: 'PRE-077',
      job_display_code: 'JOB-077',
      job_id: 'job-077',
    })).toBe('Ayudante de buffet')
  })

  it.each([null, '', '   '])('keeps the automatic fallback when the override is %j', (override) => {
    expect(resolveInvoiceServiceReference({
      service_reference_override: override,
      service_reference: 'JOB-077 · Limpieza · Piso',
      service_description: 'Servicio de limpieza',
      quote_display_code: 'PRE-077',
      job_display_code: 'JOB-077',
      job_id: 'job-077',
    })).toBe('JOB-077 · Limpieza · Piso')
  })

  it('falls back to the first available legacy reference without touching financial data', () => {
    const invoice = {
      service_reference_override: null,
      service_reference: null,
      service_description: null,
      quote_display_code: null,
      job_display_code: 'JOB-077',
      job_id: 'job-077',
      lines: [{ concept: 'Limpieza', quantity: 1, unit_price: 100, line_subtotal: 100 }],
      property_name: 'Piso Eixample',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
    }

    expect(resolveInvoiceServiceReference(invoice)).toBe('JOB-077')
    expect(invoice).toMatchObject({
      lines: [{ concept: 'Limpieza', quantity: 1, unit_price: 100, line_subtotal: 100 }],
      property_name: 'Piso Eixample',
      subtotal: 100,
      tax_amount: 21,
      total: 121,
    })
  })
})
