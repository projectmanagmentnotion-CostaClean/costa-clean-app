import { describe, expect, it } from 'vitest'
import { buildClientFiscalBackfillPlan, extractFiscalDataFromInvoice, summarizeClientFiscalBackfill } from './clientFiscalBackfill'
import {
  buildInvoicePricingMetadataWithClientFiscalSnapshot,
  getClientFiscalData,
  getClientFiscalIssueMessage,
  normalizeClientFiscalData,
} from './clientFiscalData'
import type { ClientListItem } from './types'
import type { InvoiceListItem } from '../invoices/types'

function createClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'Miguel Angel Flores Novoa',
    phone: null,
    email: null,
    tax_id: null,
    billing_address: null,
    status: 'active',
    source_lead_id: null,
    ...overrides,
  }
}

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-001',
    invoice_number: '2026-001',
    job_id: null,
    quote_id: null,
    client_id: 'client-1',
    issue_date: '2026-06-30',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    notes: null,
    internal_notes: null,
    pricing_metadata: null,
    ...overrides,
  }
}

describe('client fiscal data', () => {
  it('normalizes tax id and billing address consistently', () => {
    expect(normalizeClientFiscalData({
      tax_id: ' 45962701f ',
      billing_address: "  Avinguda   d’Acces Costa Brava, 10 \n  Barcelona  ",
      fiscal_name: '  Miguel   Angel Flores  ',
    })).toMatchObject({
      tax_id: '45962701F',
      billing_address: "Avinguda d'Acces Costa Brava, 10\nBarcelona",
      fiscal_name: 'Miguel Angel Flores',
    })
  })

  it('reports incomplete fiscal data and missing fields', () => {
    expect(getClientFiscalData(createClient())).toMatchObject({
      taxId: null,
      billingAddress: null,
      fiscalName: 'Miguel Angel Flores Novoa',
      isComplete: false,
      missingFields: ['tax_id', 'billing_address'],
    })
    expect(getClientFiscalIssueMessage(createClient())).toBe('Faltan NIF/CIF o direccion de facturacion en la ficha del cliente.')
  })

  it('stores a client fiscal snapshot inside invoice pricing metadata', () => {
    const metadata = buildInvoicePricingMetadataWithClientFiscalSnapshot(
      { source_quote: 'quote-1' },
      createClient({
        tax_id: '45962701F',
        billing_address: 'Avinguda de Lloret de Dalt, 10',
      }),
    )

    expect(metadata).toMatchObject({
      source_quote: 'quote-1',
      client_fiscal_snapshot: {
        client_id: 'client-1',
        tax_id: '45962701F',
        billing_address: 'Avinguda de Lloret de Dalt, 10',
        fiscal_name: 'Miguel Angel Flores Novoa',
        source: 'client_record',
      },
    })
  })
})

describe('client fiscal backfill', () => {
  it('extracts fiscal data only from issued invoices with structured snapshot', () => {
    const invoice = createInvoice({
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          tax_id: '45962701F',
          billing_address: 'Avinguda de Lloret de Dalt, 10',
        },
      },
    })

    expect(extractFiscalDataFromInvoice(invoice)).toMatchObject({
      invoiceId: 'invoice-1',
      tax_id: '45962701F',
      billing_address: 'Avinguda de Lloret de Dalt, 10',
    })
    expect(extractFiscalDataFromInvoice(createInvoice({ status: 'draft', pricing_metadata: invoice.pricing_metadata }))).toBeNull()
  })

  it('builds a backfill update for a client with missing fiscal data', () => {
    const client = createClient()
    const invoice = createInvoice({
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          tax_id: '45962701F',
          billing_address: 'Avinguda de Lloret de Dalt, 10',
        },
      },
    })

    const plan = buildClientFiscalBackfillPlan([client], [invoice])

    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({
      clientId: 'client-1',
      clientLabel: 'Miguel Angel Flores Novoa',
      nextTaxId: '45962701F',
      nextBillingAddress: 'Avinguda de Lloret de Dalt, 10',
      nextStatus: 'active',
      appliedFields: ['tax_id', 'billing_address', 'status'],
    })
    expect(summarizeClientFiscalBackfill(plan)).toMatchObject({
      updatableClients: 1,
      conflictedClients: 0,
      skippedClients: 0,
    })
  })

  it('does not overwrite existing fiscal data and detects conflicts', () => {
    const client = createClient({
      tax_id: '45962701F',
      billing_address: null,
    })
    const invoiceA = createInvoice({
      id: 'invoice-a',
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          tax_id: '45962701F',
          billing_address: 'Avinguda de Lloret de Dalt, 10',
        },
      },
    })
    const invoiceB = createInvoice({
      id: 'invoice-b',
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          tax_id: '45962701F',
          billing_address: 'Calle Mallorca 20',
        },
      },
    })

    const plan = buildClientFiscalBackfillPlan([client], [invoiceA, invoiceB])

    expect(plan.updates).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.conflicts[0]).toMatchObject({
      clientId: 'client-1',
      clientLabel: 'Miguel Angel Flores Novoa',
      field: 'billing_address',
    })
  })

  it('fills only the missing address and keeps the existing tax id untouched', () => {
    const client = createClient({
      tax_id: '45962701F',
      status: 'inactive',
    })
    const invoice = createInvoice({
      pricing_metadata: {
        client_fiscal_snapshot: {
          client_id: 'client-1',
          fiscal_name: 'Miguel Angel Flores Novoa',
          tax_id: 'DIFFERENT',
          billing_address: 'Avinguda de Lloret de Dalt, 10',
        },
      },
    })

    const plan = buildClientFiscalBackfillPlan([client], [invoice])

    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({
      nextTaxId: '45962701F',
      nextBillingAddress: 'Avinguda de Lloret de Dalt, 10',
      nextStatus: 'active',
      appliedFields: ['billing_address', 'status'],
    })
  })

  it('skips invoices without a structured snapshot even if they are paid', () => {
    const client = createClient()
    const plan = buildClientFiscalBackfillPlan([client], [createInvoice({ pricing_metadata: null, status: 'paid' })])

    expect(plan.updates).toHaveLength(0)
    expect(plan.skipped).toHaveLength(1)
    expect(plan.skipped[0]).toMatchObject({
      clientId: 'client-1',
      reason: 'no_structured_fiscal_data',
      sourceInvoiceIds: ['invoice-1'],
    })
  })
})
