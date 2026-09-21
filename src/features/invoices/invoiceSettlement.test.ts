import { describe, expect, it, vi } from 'vitest'
import type { TransferSettlementRpcResult } from '../financial/financialWriteApi'
import {
  canSettleInvoiceByTransfer,
  createInvoiceSettlementGuard,
  settleInvoiceAndRefresh,
} from './invoiceSettlement'
import type { InvoiceListItem } from './types'

function createInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    display_code: 'INV-001',
    invoice_number: '2026-001',
    job_id: null,
    client_id: 'client-1',
    issue_date: '2026-09-07',
    status: 'issued',
    subtotal: 100,
    tax_amount: 21,
    total: 121,
    outstanding_amount: 121,
    ...overrides,
  }
}

const settlementResult: TransferSettlementRpcResult = {
  payment_id: 'payment-1',
  invoice_id: 'invoice-1',
  created_payment: true,
  outstanding_before: 121,
  paid_total_after: 121,
  outstanding_after: 0,
  financial_status: 'paid',
}

describe('invoice settlement contract', () => {
  it.each([
    ['pending invoice', createInvoice()],
    ['partially paid invoice', createInvoice({ payment_status: 'partially_paid', outstanding_amount: 81 })],
  ])('allows %s', (_label, invoice) => {
    expect(canSettleInvoiceByTransfer(invoice)).toBe(true)
  })

  it.each([
    ['paid invoice', createInvoice({ payment_status: 'paid', outstanding_amount: 0 })],
    ['zero-outstanding invoice', createInvoice({ outstanding_amount: 0.009 })],
    ['cancelled invoice', createInvoice({ status: 'cancelled', outstanding_amount: 121 })],
    ['draft invoice', createInvoice({ status: 'draft', outstanding_amount: 121 })],
    ['paid-status invoice', createInvoice({ status: 'paid', outstanding_amount: 121 })],
    ['archived invoice', createInvoice({ archived_at: '2026-09-07T10:00:00.000Z' })],
    ['deleted invoice', createInvoice({ deleted_at: '2026-09-07T10:00:00.000Z' })],
  ])('rejects %s', (_label, invoice) => {
    expect(canSettleInvoiceByTransfer(invoice)).toBe(false)
  })

  it('settles through the financial contract and refreshes only after persistence', async () => {
    const settleInvoice = vi.fn(async () => settlementResult)
    const refreshInvoices = vi.fn(async () => {})
    const onSuccess = vi.fn()

    await expect(settleInvoiceAndRefresh('invoice-1', {
      settleInvoice,
      refreshInvoices,
      onSuccess,
    })).resolves.toEqual(settlementResult)

    expect(settleInvoice).toHaveBeenCalledOnce()
    expect(settleInvoice).toHaveBeenCalledWith('invoice-1')
    expect(refreshInvoices).toHaveBeenCalledOnce()
    expect(onSuccess).toHaveBeenCalledWith(settlementResult)
  })

  it('does not report success when the financial contract fails', async () => {
    const error = new Error('RPC failure')
    const onSuccess = vi.fn()
    const onError = vi.fn()

    await expect(settleInvoiceAndRefresh('invoice-1', {
      settleInvoice: vi.fn(async () => { throw error }),
      refreshInvoices: vi.fn(async () => {}),
      onSuccess,
      onError,
    })).rejects.toThrow('RPC failure')

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('prevents two frontend settlement requests for the same invoice', async () => {
    const guard = createInvoiceSettlementGuard()

    expect(guard.begin('invoice-1')).toBe(true)
    expect(guard.begin('invoice-1')).toBe(false)
    expect(guard.isBusy('invoice-1')).toBe(true)

    guard.end('invoice-1')

    expect(guard.isBusy('invoice-1')).toBe(false)
    expect(guard.begin('invoice-1')).toBe(true)
  })
})
