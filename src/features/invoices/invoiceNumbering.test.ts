import { describe, expect, it } from 'vitest'
import type { InvoiceListItem } from './types'
import {
  buildInvoiceDisplayCode,
  buildInvoiceNumber,
  buildInvoiceNumberingAudit,
  describeInvoiceNumberingGap,
  parseInvoiceDisplaySequence,
  parseInvoiceFiscalSequence,
} from './invoiceNumbering'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    display_code: overrides.display_code ?? null,
    invoice_number: overrides.invoice_number ?? null,
    job_id: overrides.job_id ?? null,
    client_id: overrides.client_id ?? 'client-1',
    issue_date: overrides.issue_date ?? '2026-06-01',
    status: overrides.status ?? 'draft',
    subtotal: overrides.subtotal ?? 100,
    tax_amount: overrides.tax_amount ?? 21,
    total: overrides.total ?? 121,
    ...overrides,
  }
}

describe('invoiceNumbering', () => {
  it('parses fiscal and display sequences', () => {
    expect(parseInvoiceFiscalSequence('2026-048', 2026)).toBe(48)
    expect(parseInvoiceFiscalSequence('2025-048', 2026)).toBeNull()
    expect(parseInvoiceDisplaySequence('INV-0048')).toBe(48)
  })

  it('detects gaps and suggests the next sequence after real issued invoices', () => {
    const audit = buildInvoiceNumberingAudit([
      createInvoice({ display_code: 'INV-0042', invoice_number: '2026-042', status: 'paid' }),
      createInvoice({ display_code: 'INV-0048', invoice_number: '2026-048', status: 'paid', issue_date: '2026-06-08' }),
      createInvoice({ display_code: 'INV-0049', invoice_number: '2026-049', status: 'issued', issue_date: '2026-06-30' }),
    ], 2026)

    expect(JSON.stringify(audit.gaps)).toBe(JSON.stringify([{ from: 43, to: 47 }]))
    expect(audit.nextSuggestedSequence).toBe(50)
    expect(audit.nextSuggestedInvoiceNumber).toBe('2026-050')
    expect(audit.nextSuggestedDisplayCode).toBe('INV-0050')
    expect(describeInvoiceNumberingGap(audit)).toBe('Se detecto un salto entre 2026-042 y 2026-048.')
  })

  it('does not let draft invoices without number consume the next fiscal sequence', () => {
    const audit = buildInvoiceNumberingAudit([
      createInvoice({ display_code: 'INV-0042', invoice_number: '2026-042', status: 'paid' }),
      createInvoice({ status: 'draft', display_code: null, invoice_number: null, issue_date: '2026-06-15' }),
    ], 2026)

    expect(audit.nextSuggestedSequence).toBe(43)
    expect(audit.draftsWithReservedNumbers).toHaveLength(0)
  })

  it('flags drafts that already reserved a number', () => {
    const audit = buildInvoiceNumberingAudit([
      createInvoice({ display_code: 'INV-0042', invoice_number: '2026-042', status: 'paid' }),
      createInvoice({ display_code: 'INV-0043', invoice_number: '2026-043', status: 'draft' }),
    ], 2026)

    expect(audit.nextSuggestedSequence).toBe(44)
    expect(audit.draftsWithReservedNumbers).toHaveLength(1)
  })

  it('detects out-of-sync internal and fiscal sequences', () => {
    const audit = buildInvoiceNumberingAudit([
      createInvoice({ display_code: buildInvoiceDisplayCode(60), invoice_number: buildInvoiceNumber(2026, 42), status: 'issued' }),
    ], 2026)

    expect(audit.outOfSyncEntries).toHaveLength(1)
  })
})
