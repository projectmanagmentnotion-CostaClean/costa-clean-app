import { describe, expect, it } from 'vitest'
import { canCreateInvoiceFromJob } from './jobInvoiceEligibility'

const job = { id: 'job-1', display_code: 'SRV-0001', client_id: 'client-1', property_id: 'property-1', quote_id: null, scheduled_date: '2026-09-08', status: 'completed', service_type: 'standard_cleaning' }

describe('canCreateInvoiceFromJob', () => {
  it('allows only completed unbilled jobs', () => {
    expect(canCreateInvoiceFromJob(job, [])).toBe(true)
    expect(canCreateInvoiceFromJob({ ...job, status: 'scheduled' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, cancelled_at: '2026-09-08T00:00:00Z' }, [])).toBe(false)
  })

  it('blocks an active invoice relation', () => {
    expect(canCreateInvoiceFromJob(job, [{ id: 'invoice-1', job_id: 'job-1', status: 'draft' } as never])).toBe(false)
  })
})
