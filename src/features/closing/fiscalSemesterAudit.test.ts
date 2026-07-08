import { describe, expect, it } from 'vitest'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import { buildFiscalSemesterAuditSummary } from './fiscalSemesterAudit'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: overrides.id ?? 'inv-1',
    display_code: overrides.display_code ?? 'INV-0001',
    invoice_number: overrides.invoice_number ?? '2026-001',
    job_id: overrides.job_id ?? null,
    quote_id: overrides.quote_id ?? null,
    client_id: overrides.client_id ?? 'client-1',
    issue_date: overrides.issue_date ?? '2026-07-02',
    status: overrides.status ?? 'issued',
    subtotal: overrides.subtotal ?? 100,
    tax_amount: overrides.tax_amount ?? 21,
    total: overrides.total ?? 121,
    archived_at: overrides.archived_at ?? null,
    deleted_at: overrides.deleted_at ?? null,
    cancelled_at: overrides.cancelled_at ?? null,
    notes: overrides.notes ?? null,
    internal_notes: overrides.internal_notes ?? null,
    pricing_metadata: overrides.pricing_metadata ?? null,
    lines: overrides.lines ?? [
      {
        id: 'line-1',
        invoice_id: overrides.id ?? 'inv-1',
        sort_order: 1,
        concept: 'Servicio',
        quantity: 1,
        unit: 'ud',
        unit_price: 100,
        line_subtotal: 100,
      },
    ],
  }
}

describe('buildFiscalSemesterAuditSummary', () => {
  it('includes only emitted second-semester invoices and aggregates totals', () => {
    const clients: ClientListItem[] = [
      {
        id: 'client-1',
        display_code: 'CLI-001',
        created_at: '2026-01-01',
        full_name: 'Cliente Uno',
        phone: null,
        email: null,
        tax_id: null,
        billing_address: null,
        status: 'active',
        source_lead_id: null,
      },
    ]
    const payments: PaymentListItem[] = [
      {
        id: 'pay-1',
        display_code: 'PAY-1',
        invoice_id: 'inv-1',
        payment_date: '2026-07-10',
        created_at: '2026-07-10T10:00:00Z',
        amount: 121,
        payment_method: 'transfer',
        origin_type: 'manual',
        notes: null,
      },
    ]
    const invoices: InvoiceListItem[] = [
      createInvoice(),
      createInvoice({ id: 'inv-2', issue_date: '2026-06-30', invoice_number: '2026-000', display_code: 'INV-0000' }),
      createInvoice({ id: 'inv-3', status: 'draft', invoice_number: null, display_code: null }),
      createInvoice({ id: 'inv-4', status: 'paid', issue_date: '2026-09-15', subtotal: 200, tax_amount: 42, total: 242, invoice_number: '2026-002', display_code: 'INV-0002' }),
    ]

    const result = buildFiscalSemesterAuditSummary({
      year: 2026,
      invoices,
      payments,
      clients,
    })

    expect(result.totals).toMatchObject({
      invoiceCount: 2,
      baseAmount: 300,
      vatAmount: 63,
      totalAmount: 363,
      paidAmount: 121,
      pendingAmount: 242,
    })
    expect(JSON.stringify(result.includedInvoices.map((invoice) => invoice.reference))).toBe(JSON.stringify(['2026-001', '2026-002']))
    expect(result.excludedInvoices).toHaveLength(1)
    expect(result.excludedInvoices[0]?.reason).toBe('Estado no emitido: draft')
    expect(result.includedInvoices[0]?.clientLabel).toBe('Cliente Uno')
  })

  it('flags duplicate references and line/header mismatches', () => {
    const invoices: InvoiceListItem[] = [
      createInvoice({
        id: 'inv-a',
        invoice_number: '2026-010',
        display_code: 'INV-0010',
        subtotal: 100,
        tax_amount: 21,
        total: 120,
        lines: [{
          id: 'line-a',
          invoice_id: 'inv-a',
          sort_order: 1,
          concept: 'Servicio',
          quantity: 1,
          unit: 'ud',
          unit_price: 90,
          line_subtotal: 90,
        }],
      }),
      createInvoice({
        id: 'inv-b',
        invoice_number: '2026-010',
        display_code: 'INV-0010',
        issue_date: '2026-08-03',
      }),
    ]

    const result = buildFiscalSemesterAuditSummary({
      year: 2026,
      invoices,
    })

    expect(result.reviewItems.some((item) => item.id === 'duplicate-invoice-number-2026-010')).toBe(true)
    expect(result.reviewItems.some((item) => item.id === 'duplicate-display-code-INV-0010')).toBe(true)
    expect(result.reviewItems.some((item) => item.id === 'header-total-mismatch-inv-a')).toBe(true)
    expect(result.reviewItems.some((item) => item.id === 'line-total-mismatch-inv-a')).toBe(true)
  })
})
