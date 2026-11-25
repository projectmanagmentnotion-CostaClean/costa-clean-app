import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { ClientListItem } from '../../features/clients/types'
import type { PaymentListItem } from '../../features/payments/types'
import { V3PaymentCreateFlow } from './V3PaymentCreateFlow'

function invoice(id: string, status: string, overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id,
    display_code: `INV-${id}`,
    invoice_number: id,
    job_id: null,
    client_id: 'client-1',
    issue_date: '2026-11-24',
    status,
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    outstanding_amount: 121,
    ...overrides,
  }
}

describe('V3PaymentCreateFlow invoice eligibility', () => {
  it('offers only active issued invoices with an outstanding balance', () => {
    const markup = renderToStaticMarkup(createElement(V3PaymentCreateFlow, {
      invoices: [
        invoice('issued', 'issued'),
        invoice('partial', 'issued', { payment_status: 'partially_paid', outstanding_amount: 50 }),
        invoice('draft', 'draft'),
        invoice('cancelled', 'cancelled'),
        invoice('archived', 'issued', { archived_at: '2026-11-24T10:00:00Z' }),
        invoice('deleted', 'issued', { deleted_at: '2026-11-24T10:00:00Z' }),
        invoice('paid', 'issued', { outstanding_amount: 0 }),
      ],
      clients: [{ id: 'client-1', full_name: 'Cliente sintético' }] as unknown as ClientListItem[],
      payments: [] as PaymentListItem[],
      onRefreshData: async () => undefined,
      onCompleted: () => undefined,
      onCancel: () => undefined,
    }))

    expect(markup).toContain('<option value="issued" selected="">INV-issued')
    expect(markup).toContain('<option value="partial">INV-partial')
    for (const blocked of ['draft', 'cancelled', 'archived', 'deleted', 'paid']) {
      expect(markup).not.toContain(`value="${blocked}"`)
    }
  })
})
