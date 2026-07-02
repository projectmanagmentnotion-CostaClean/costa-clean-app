import { describe, expect, it } from 'vitest'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from './types'
import {
  backfillInvoiceFiscalSnapshot,
  buildInvoiceFiscalBlockedEntries,
  buildInvoiceFiscalAudit,
  canBackfillInvoiceFiscalSnapshot,
  describeInvoiceFiscalMissingFields,
  hasCompleteInvoiceFiscalSnapshot,
  shouldShowInvoiceFiscalDebug,
} from './invoiceFiscalSnapshot'

function createClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'Cliente Fiscal',
    phone: null,
    email: 'cliente@example.com',
    tax_id: 'B12345678',
    billing_address: 'Calle Mayor 1\nBarcelona',
    status: 'active',
    source_lead_id: null,
    ...overrides,
  }
}

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-0001',
    invoice_number: '2026-001',
    job_id: null,
    quote_id: null,
    client_id: 'client-1',
    issue_date: '2026-07-02',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    pricing_metadata: null,
    ...overrides,
  }
}

describe('invoiceFiscalSnapshot', () => {
  it('detects complete snapshots already persisted in pricing metadata', () => {
    const invoice = createInvoice({
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          fiscal_name: 'Cliente Fiscal',
          tax_id: 'B12345678',
          billing_address: 'Calle Mayor 1\nBarcelona',
          email: 'cliente@example.com',
          captured_at: '2026-07-02T10:00:00.000Z',
          source: 'client_record',
        },
      },
    })

    expect(hasCompleteInvoiceFiscalSnapshot(invoice)).toBe(true)
  })

  it('marks invoices without snapshot as reparable when the client is complete', () => {
    const invoice = createInvoice()
    const client = createClient()

    expect(canBackfillInvoiceFiscalSnapshot(invoice, client)).toBe(true)

    const metadata = backfillInvoiceFiscalSnapshot(invoice, client)
    expect(metadata).toMatchObject({
      client_fiscal_snapshot: {
        client_id: 'client-1',
        fiscal_name: 'Cliente Fiscal',
        tax_id: 'B12345678',
        billing_address: 'Calle Mayor 1\nBarcelona',
        email: 'cliente@example.com',
        source: 'client_backfill',
      },
      fiscal_backfill_source: 'client',
    })
  })

  it('keeps invoices blocked when the client still lacks fiscal fields', () => {
    const invoice = createInvoice()
    const client = createClient({
      tax_id: null,
      billing_address: null,
    })

    expect(canBackfillInvoiceFiscalSnapshot(invoice, client)).toBe(false)
    expect(backfillInvoiceFiscalSnapshot(invoice, client)).toBeNull()
  })

  it('does not overwrite a complete snapshot during backfill', () => {
    const invoice = createInvoice({
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          fiscal_name: 'Snapshot Original',
          tax_id: 'B12345678',
          billing_address: 'Direccion Original',
          email: 'original@example.com',
          captured_at: '2026-07-01T09:00:00.000Z',
          source: 'client_record',
        },
      },
    })

    const client = createClient({
      full_name: 'Cliente Modificado',
      billing_address: 'Otra direccion',
    })

    expect(backfillInvoiceFiscalSnapshot(invoice, client)).toBeNull()
  })

  it('builds a real audit summary with complete, reparable and incomplete buckets', () => {
    const completeInvoice = createInvoice({
      id: 'invoice-complete',
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          fiscal_name: 'Cliente Fiscal',
          tax_id: 'B12345678',
          billing_address: 'Calle Mayor 1\nBarcelona',
          captured_at: '2026-07-02T10:00:00.000Z',
          source: 'client_record',
        },
      },
    })
    const reparableInvoice = createInvoice({ id: 'invoice-reparable', pricing_metadata: null })
    const incompleteInvoice = createInvoice({ id: 'invoice-incomplete', client_id: 'client-2', pricing_metadata: null })

    const audit = buildInvoiceFiscalAudit(
      [completeInvoice, reparableInvoice, incompleteInvoice],
      [
        createClient(),
        createClient({ id: 'client-2', full_name: 'Cliente Incompleto', tax_id: null, billing_address: null }),
      ],
    )

    expect(audit.summary).toMatchObject({
      total: 3,
      complete: 1,
      reparable: 1,
      incomplete: 1,
    })
  })

  it('builds compact blocked entries with the missing fiscal fields', () => {
    const audit = buildInvoiceFiscalAudit(
      [createInvoice({ id: 'invoice-incomplete', client_id: 'client-2', pricing_metadata: null })],
      [
        createClient({ id: 'client-2', full_name: 'Cliente Incompleto', tax_id: null, billing_address: null }),
      ],
    )

    const blockedEntries = buildInvoiceFiscalBlockedEntries(audit.entries)

    expect(blockedEntries).toHaveLength(1)
    expect(blockedEntries[0]).toMatchObject({
      invoiceId: 'invoice-incomplete',
      clientLabel: 'Cliente Incompleto',
      missingFields: ['name', 'tax_id', 'billing_address'],
    })
    expect(describeInvoiceFiscalMissingFields(['tax_id', 'billing_address'])).toBe('Falta NIF/CIF y direccion fiscal')
  })

  it('shows invoice fiscal debug only when the query param is present', () => {
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '?debugInvoiceFiscal=1' },
      },
    })
    expect(shouldShowInvoiceFiscalDebug()).toBe(true)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { search: '?debugBuild=1' },
      },
    })
    expect(shouldShowInvoiceFiscalDebug()).toBe(false)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })
})
