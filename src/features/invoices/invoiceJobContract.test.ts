import { describe, expect, it } from 'vitest'
import { resolveInvoiceJobId } from './invoiceJobContract'

describe('invoice job contract', () => {
  it('preserves a selected job for job-origin invoices', () => {
    expect(resolveInvoiceJobId('job', 'job-1')).toBe('job-1')
  })

  it('writes null for manual and other non-job origins', () => {
    expect(resolveInvoiceJobId('client', '')).toBeNull()
    expect(resolveInvoiceJobId('property', 'job-ignored')).toBeNull()
  })
})
