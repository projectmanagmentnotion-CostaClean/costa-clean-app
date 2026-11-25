import { describe, expect, it } from 'vitest'
import { canCreateInvoiceFromJob } from './jobInvoiceEligibility'

const job = { id: 'job-1', display_code: 'SRV-0001', client_id: 'client-1', property_id: 'property-1', quote_id: null, scheduled_date: '2026-09-08', status: 'completed', service_type: 'standard_cleaning' }

describe('canCreateInvoiceFromJob', () => {
  it('allows only completed unbilled jobs', () => {
    expect(canCreateInvoiceFromJob(job, [])).toBe(true)
    expect(canCreateInvoiceFromJob({ ...job, status: 'scheduled' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, cancelled_at: '2026-09-08T00:00:00Z' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, archived_at: '2026-09-08T00:00:00Z' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, deleted_at: '2026-09-08T00:00:00Z' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, id: '' }, [])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, client_id: '' }, [])).toBe(false)
  })

  it('blocks active invoices related by job id or the Job invoice id', () => {
    expect(canCreateInvoiceFromJob(job, [{ id: 'invoice-1', job_id: 'job-1', status: 'draft' } as never])).toBe(false)
    expect(canCreateInvoiceFromJob({ ...job, invoice_id: 'invoice-2' }, [{ id: 'invoice-2', job_id: null, status: 'issued' } as never])).toBe(false)
  })

  it('allows a new invoice after related invoices are cancelled or inactive', () => {
    expect(canCreateInvoiceFromJob(job, [{ id: 'cancelled', job_id: 'job-1', status: 'cancelled' } as never])).toBe(true)
    expect(canCreateInvoiceFromJob(job, [{ id: 'archived', job_id: 'job-1', status: 'draft', archived_at: '2026-09-08T00:00:00Z' } as never])).toBe(true)
    expect(canCreateInvoiceFromJob(job, [{ id: 'deleted', job_id: 'job-1', status: 'draft', deleted_at: '2026-09-08T00:00:00Z' } as never])).toBe(true)
  })
})
