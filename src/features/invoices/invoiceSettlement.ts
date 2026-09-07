import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'
import type { InvoiceListItem } from './types'
import type { TransferSettlementRpcResult } from '../financial/financialWriteApi'

export const INVOICE_SETTLEMENT_TOLERANCE = 0.009

export function getInvoiceSettlementOutstanding(invoice: Pick<InvoiceListItem, 'outstanding_amount' | 'total'>): number {
  return Math.max(Number(invoice.outstanding_amount ?? invoice.total ?? 0), 0)
}

export function canSettleInvoiceByTransfer(invoice: InvoiceListItem): boolean {
  return invoice.status === 'issued'
    && !isArchivedEntity(invoice)
    && !isDeletedEntity(invoice)
    && !isCancelledEntity(invoice)
    && getInvoiceSettlementOutstanding(invoice) > INVOICE_SETTLEMENT_TOLERANCE
}

export interface InvoiceSettlementDependencies {
  settleInvoice: (invoiceId: string) => Promise<TransferSettlementRpcResult>
  refreshInvoices: () => Promise<void>
  onSuccess?: (result: TransferSettlementRpcResult) => void
  onError?: (error: unknown) => void
}

export async function settleInvoiceAndRefresh(
  invoiceId: string,
  dependencies: InvoiceSettlementDependencies,
): Promise<TransferSettlementRpcResult> {
  try {
    const result = await dependencies.settleInvoice(invoiceId)
    await dependencies.refreshInvoices()
    dependencies.onSuccess?.(result)
    return result
  } catch (error) {
    dependencies.onError?.(error)
    throw error
  }
}

export function createInvoiceSettlementGuard() {
  const busyInvoiceIds = new Set<string>()

  return {
    begin(invoiceId: string): boolean {
      if (busyInvoiceIds.has(invoiceId)) return false
      busyInvoiceIds.add(invoiceId)
      return true
    },
    end(invoiceId: string): void {
      busyInvoiceIds.delete(invoiceId)
    },
    isBusy(invoiceId: string): boolean {
      return busyInvoiceIds.has(invoiceId)
    },
  }
}
