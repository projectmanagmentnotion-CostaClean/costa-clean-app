import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import { buildInvoiceCreatePrefillFromJob } from '../features/invoices/invoiceCreatePrefill'
import { V3InvoiceCreateFlow } from './invoices/V3InvoiceCreateFlow'
import { V3PaymentCreateFlow } from './payments/V3PaymentCreateFlow'

const internalId = 'a2b4c6d8-1111-2222-3333-444444444444'
const clients = [{ id: 'client-1', full_name: 'Cliente de prueba' }] as unknown as ClientListItem[]
const noOp = async () => undefined

describe('V3 finance human-readable selector fallbacks', () => {
  it('does not render internal ids for related jobs, quotes or invoices without a public code', () => {
    const invoiceForm = renderToStaticMarkup(createElement(V3InvoiceCreateFlow, {
      clients,
      properties: [],
      jobs: [{ id: internalId, client_id: 'client-1', display_code: internalId }] as unknown as JobListItem[],
      quotes: [{ id: internalId, client_id: 'client-1', display_code: internalId }] as unknown as QuoteListItem[],
      invoices: [],
      onRefreshData: noOp,
      onCompleted: noOp,
      onCancel: () => undefined,
      prefillClientId: 'client-1',
    }))
    const paymentForm = renderToStaticMarkup(createElement(V3PaymentCreateFlow, {
      clients,
      invoices: [{ id: internalId, client_id: 'client-1', display_code: internalId, invoice_number: internalId, issue_date: '2026-11-24', status: 'issued', subtotal: 10, tax_amount: 2, total: 12, outstanding_amount: 12 }] as unknown as InvoiceListItem[],
      payments: [] as PaymentListItem[],
      onRefreshData: noOp,
      onCompleted: noOp,
      onCancel: () => undefined,
    }))

    expect(invoiceForm).toContain('Servicio sin código')
    expect(invoiceForm).toContain('Presupuesto sin código')
    expect(paymentForm).toContain('Factura sin referencia')
    expect(`${invoiceForm}\n${paymentForm}`).not.toContain(`>${internalId}<`)
  })

  it('keeps the complete Job context when opening the V3 invoice flow', () => {
    const prefill = buildInvoiceCreatePrefillFromJob({
      id: 'job-1', display_code: 'JOB-1', client_id: 'client-1', property_id: 'property-1', quote_id: 'quote-1',
      scheduled_date: '2026-11-24', status: 'completed', service_type: 'standard_cleaning',
      billing_concept: 'Limpieza general', billing_quantity: 2, billing_unit: 'hora', billing_unit_price: 50,
      billing_lines: [
        { concept: 'Limpieza general', quantity: 2, unit: 'hora', unit_price: 50, line_subtotal: 100 },
        { concept: 'Cristales', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
      ],
      notes: 'Notas heredadas del servicio',
    } as JobListItem)!
    const markup = renderToStaticMarkup(createElement(V3InvoiceCreateFlow, {
      clients,
      properties: [{ id: 'property-1', client_id: 'client-1', name: 'Inmueble QA' }] as unknown as PropertyListItem[],
      jobs: [{ id: 'job-1', client_id: 'client-1', display_code: 'JOB-1' }] as unknown as JobListItem[],
      quotes: [{ id: 'quote-1', client_id: 'client-1', display_code: 'QUOTE-1' }] as unknown as QuoteListItem[],
      invoices: [],
      prefill,
      onRefreshData: noOp,
      onCompleted: noOp,
      onCancel: () => undefined,
    }))

    expect(markup).toContain('<option value="property-1" selected="">Inmueble QA</option>')
    expect(markup).toContain('<option value="job-1" selected="">JOB-1</option>')
    expect(markup).toContain('<option value="quote-1" selected="">QUOTE-1</option>')
    expect(markup).toContain('value="Limpieza general"')
    expect(markup).toContain('value="2.00"')
    expect(markup).toContain('value="50.00"')
    expect(markup).toContain('value="Cristales"')
    expect(markup).toContain('Notas heredadas del servicio')
    expect(markup).toContain('Precios sin IVA.')
  })
})
