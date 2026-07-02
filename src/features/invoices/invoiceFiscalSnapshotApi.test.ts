import { describe, expect, it } from 'vitest'
import type { ClientListItem } from '../clients/types'
import type { InvoiceListItem } from './types'
import {
  __invoiceFiscalSnapshotApiTestUtils,
  runInvoiceFiscalBackfillWithDependencies,
} from './invoiceFiscalSnapshotApi'

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

function createDependencies({
  rpcResponse,
  restResponses,
}: {
  rpcResponse: { data: unknown; error: { code?: string | null; message?: string | null } | null }
  restResponses?: Array<{ data: { id: string; pricing_metadata?: Record<string, unknown> | null } | null; error: { code?: string | null; message?: string | null } | null }>
}) {
  const queuedRestResponses = [...(restResponses ?? [])]

  return {
    getClient: () => ({
      rpc: async () => rpcResponse,
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => queuedRestResponses.shift() ?? { data: null, error: null },
            }),
          }),
        }),
      }),
    }),
    recordAuditEventFn: async () => {},
  }
}

describe('invoiceFiscalSnapshotApi', () => {
  it('does not count REST writes as repaired when Supabase confirms zero rows', async () => {
    const result = await runInvoiceFiscalBackfillWithDependencies(
      [createInvoice()],
      [createClient()],
      createDependencies({
        rpcResponse: {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.backfill_invoice_fiscal_snapshots in the schema cache',
          },
        },
        restResponses: [{ data: null, error: null }],
      }),
    )

    expect(result).toMatchObject({
      expectedRepairable: 1,
      repaired: 0,
      failed: 1,
      blocked: 0,
      mode: 'rest',
    })
  })

  it('requires read-after-write confirmation of client_fiscal_snapshot in REST fallback', async () => {
    const result = await runInvoiceFiscalBackfillWithDependencies(
      [createInvoice()],
      [createClient()],
      createDependencies({
        rpcResponse: {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.backfill_invoice_fiscal_snapshots in the schema cache',
          },
        },
        restResponses: [{
          data: {
            id: 'invoice-1',
            pricing_metadata: { fiscal_backfill_source: 'client' },
          },
          error: null,
        }],
      }),
    )

    expect(result).toMatchObject({
      repaired: 0,
      failed: 1,
      mode: 'rest',
    })
  })

  it('uses the REST fallback when the RPC does not exist and confirms the persisted snapshot', async () => {
    const result = await runInvoiceFiscalBackfillWithDependencies(
      [createInvoice()],
      [createClient()],
      createDependencies({
        rpcResponse: {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.backfill_invoice_fiscal_snapshots in the schema cache',
          },
        },
        restResponses: [{
          data: {
            id: 'invoice-1',
            pricing_metadata: {
              client_fiscal_snapshot: {
                client_id: 'client-1',
                fiscal_name: 'Cliente Fiscal',
                tax_id: 'B12345678',
                billing_address: 'Calle Mayor 1\nBarcelona',
              },
            },
          },
          error: null,
        }],
      }),
    )

    expect(result).toMatchObject({
      repaired: 1,
      failed: 0,
      blocked: 0,
      mode: 'rest',
      repairedInvoiceIds: ['invoice-1'],
    })
  })

  it('uses the RPC result when Supabase confirms repaired and blocked totals', async () => {
    const result = await runInvoiceFiscalBackfillWithDependencies(
      [createInvoice()],
      [createClient()],
      createDependencies({
        rpcResponse: {
          data: {
            total_invoices: 44,
            repaired: 42,
            blocked: 2,
            failed: 0,
            repaired_invoice_ids: ['invoice-1', 'invoice-2'],
            blocked_invoice_ids: ['invoice-7', 'invoice-8'],
          },
          error: null,
        },
      }),
    )

    expect(result).toMatchObject({
      repaired: 42,
      blocked: 2,
      failed: 0,
      mode: 'rpc',
      repairedInvoiceIds: ['invoice-1', 'invoice-2'],
      blockedInvoiceIds: ['invoice-7', 'invoice-8'],
    })
  })

  it('detects missing RPC errors and verified snapshot payloads with dedicated helpers', () => {
    expect(__invoiceFiscalSnapshotApiTestUtils.shouldFallbackToRest({
      code: 'PGRST202',
      message: 'Could not find the function public.backfill_invoice_fiscal_snapshots in the schema cache',
    })).toBe(true)
    expect(__invoiceFiscalSnapshotApiTestUtils.hasVerifiedFiscalSnapshot({
      client_fiscal_snapshot: {
        client_id: 'client-1',
      },
    })).toBe(true)
    expect(__invoiceFiscalSnapshotApiTestUtils.buildNoPersistMessage()).toBe(
      'El backfill detecto facturas reparables, pero Supabase no confirmo ninguna actualizacion.',
    )
  })
})
