import { describe, expect, it } from 'vitest'
import type { JobListItem } from '../jobs/types'
import { isJobAvailableForInvoiceLink, isJobAvailableForQuoteInvoiceLink } from './invoiceJobEligibility'

function createJob(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'job-1',
    display_code: 'JOB-0001',
    client_id: 'client-1',
    property_id: 'property-1',
    quote_id: null,
    scheduled_date: '2026-11-12',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    ...overrides,
  }
}

describe('isJobAvailableForInvoiceLink', () => {
  it('allows an active unbilled service matching the invoice relationships', () => {
    expect(isJobAvailableForInvoiceLink(createJob(), 'client-1', 'property-1')).toBe(true)
  })

  it.each([
    ['archived service', { archived_at: '2026-11-11T00:00:00Z' }],
    ['deleted service', { deleted_at: '2026-11-11T00:00:00Z' }],
    ['service with cancellation timestamp', { cancelled_at: '2026-11-11T00:00:00Z' }],
    ['cancelled status', { status: 'cancelled' }],
    ['completed status', { status: 'completed' }],
    ['service already linked to an invoice', { invoice_id: 'invoice-1' }],
  ])('rejects %s', (_label, overrides) => {
    expect(isJobAvailableForInvoiceLink(createJob(overrides), 'client-1', 'property-1')).toBe(false)
  })

  it('rejects a service belonging to another client or property', () => {
    const job = createJob()

    expect(isJobAvailableForInvoiceLink(job, 'client-2', 'property-1')).toBe(false)
    expect(isJobAvailableForInvoiceLink(job, 'client-1', 'property-2')).toBe(false)
  })
})

describe('isJobAvailableForQuoteInvoiceLink', () => {
  it('allows an active job linked to the same quote or no quote', () => {
    expect(isJobAvailableForQuoteInvoiceLink(createJob(), 'quote-1', 'client-1', 'property-1')).toBe(true)
    expect(isJobAvailableForQuoteInvoiceLink(createJob({ quote_id: 'quote-1' }), 'quote-1', 'client-1', 'property-1')).toBe(true)
  })

  it('rejects an active job that belongs to another quote', () => {
    expect(isJobAvailableForQuoteInvoiceLink(createJob({ quote_id: 'quote-2' }), 'quote-1', 'client-1', 'property-1')).toBe(false)
  })
})
