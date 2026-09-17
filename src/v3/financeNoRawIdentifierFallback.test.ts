import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { PaymentListItem } from '../features/payments/types'
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
      invoices: [{ id: internalId, client_id: 'client-1', display_code: internalId, invoice_number: internalId, total: 12, outstanding_amount: 12 }] as unknown as InvoiceListItem[],
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
})
