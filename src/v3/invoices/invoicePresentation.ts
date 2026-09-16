import { formatCurrency } from '../../app/displayFormat'
import { canSettleInvoiceByTransfer, getInvoiceSettlementOutstanding } from '../../features/invoices/invoiceSettlement'
import type { InvoiceFinancialStatus } from '../../features/invoices/paymentState'
import type { InvoiceListItem } from '../../features/invoices/types'

export function getInvoiceFinancialFacts(invoice: InvoiceListItem): {
  total: number
  paid: number
  outstanding: number
  status: InvoiceFinancialStatus
  settlementAllowed: boolean
} {
  const total = Number(invoice.total ?? 0)
  const outstanding = getInvoiceSettlementOutstanding(invoice)
  const paid = Math.max(Number(invoice.paid_amount ?? total - outstanding), 0)
  const rawStatus = invoice.payment_status ?? invoice.status

  return {
    total,
    paid,
    outstanding,
    status: (rawStatus === 'issued' ? 'pending' : rawStatus) as InvoiceFinancialStatus,
    settlementAllowed: canSettleInvoiceByTransfer(invoice),
  }
}

export function getInvoiceSettlementDescription(invoice: InvoiceListItem): string {
  const facts = getInvoiceFinancialFacts(invoice)
  return `Se registrará un cobro por transferencia de ${formatCurrency(facts.outstanding)}. Total: ${formatCurrency(facts.total)}. Ya cobrado: ${formatCurrency(facts.paid)}. Saldo pendiente: ${formatCurrency(facts.outstanding)}. El estado se actualizará solo después de que el contrato financiero confirme el cobro.`
}
