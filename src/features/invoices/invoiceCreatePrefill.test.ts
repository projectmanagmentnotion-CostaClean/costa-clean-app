import { describe, expect, it } from 'vitest'
import { buildInvoiceCreatePrefillFromJob, buildInvoiceCreatePrefillFromQuote } from './invoiceCreatePrefill'
import type { JobListItem } from '../jobs/types'
import type { QuoteListItem } from '../quotes/types'

const job: JobListItem = {
  id: 'job-1',
  display_code: 'SER-001',
  client_id: 'client-1',
  property_id: 'property-1',
  quote_id: 'quote-1',
  scheduled_date: '2026-09-20',
  status: 'completed',
  service_type: 'standard_cleaning',
  billing_concept: 'Limpieza final',
  billing_quantity: 2,
  billing_unit: 'service',
  billing_unit_price: 75,
  notes: 'Acceso por portal.',
  billing_lines: null,
}

const quote: QuoteListItem = {
  id: 'quote-1',
  display_code: 'PRE-001',
  client_id: 'client-1',
  property_id: 'property-1',
  status: 'accepted',
  subtotal: 150,
  tax_amount: 31.5,
  total: 181.5,
  notes: 'Condiciones acordadas.',
  quote_lines: [{
    id: 'quote-line-1',
    quote_id: 'quote-1',
    sort_order: 1,
    concept: 'Limpieza final',
    quantity: 2,
    unit: 'servicio',
    unit_price: 75,
    line_subtotal: 150,
  }],
}

describe('invoice source prefill contract', () => {
  it('carries job source relationships and editable billing context', () => {
    const prefill = buildInvoiceCreatePrefillFromJob(job)

    expect(prefill).toMatchObject({
      origin_kind: 'job',
      job_id: 'job-1',
      quote_id: 'quote-1',
      client_id: 'client-1',
      property_id: 'property-1',
    })
    expect(prefill?.lines).toEqual([{
      concept: 'Limpieza final',
      quantity: '2.00',
      unit: 'servicio',
      unit_price: '75.00',
    }])
  })

  it('carries quote relationships, tax-neutral editable lines and notes without creating anything', () => {
    const prefill = buildInvoiceCreatePrefillFromQuote(quote)

    expect(prefill).toMatchObject({
      origin_kind: 'quote',
      job_id: '',
      quote_id: 'quote-1',
      client_id: 'client-1',
      property_id: 'property-1',
      notes: 'Condiciones acordadas.',
    })
    expect(prefill?.lines).toEqual([{
      concept: 'Limpieza final',
      quantity: '2.00',
      unit: 'servicio',
      unit_price: '75.00',
    }])
  })

  it('rejects source context without a client relationship', () => {
    expect(buildInvoiceCreatePrefillFromJob({ ...job, client_id: '' })).toBeNull()
    expect(buildInvoiceCreatePrefillFromQuote({ ...quote, client_id: null })).toBeNull()
  })
})
