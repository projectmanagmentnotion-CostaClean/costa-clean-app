import { getPaymentMethodLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { PaymentListItem } from '../payments/types'
import type { InvoiceListItem } from './types'

export type InvoiceFinancialStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled'

export interface InvoicePaymentSummary {
  financialStatus: InvoiceFinancialStatus
  paidAmount: number
  outstandingAmount: number
  paymentCount: number
  lastPayment: PaymentListItem | null
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function buildInvoicePaymentSummary(
  invoice: Pick<InvoiceListItem, 'total' | 'status' | 'id'>,
  payments: PaymentListItem[],
): InvoicePaymentSummary {
  const paidAmount = roundMoney(
    payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
  )
  const total = roundMoney(Number(invoice.total ?? 0))
  const outstandingAmount = roundMoney(Math.max(total - paidAmount, 0))
  const lastPayment = payments.length > 0
    ? [...payments].sort((left, right) => {
      const byDate = right.payment_date.localeCompare(left.payment_date)
      if (byDate !== 0) return byDate
      return (right.created_at ?? '').localeCompare(left.created_at ?? '')
    })[0]
    : null

  const financialStatus: InvoiceFinancialStatus = invoice.status === 'cancelled'
    ? 'cancelled'
    : outstandingAmount <= 0.009
      ? 'paid'
      : paidAmount > 0.009
        ? 'partially_paid'
        : 'pending'

  return {
    financialStatus,
    paidAmount,
    outstandingAmount,
    paymentCount: payments.length,
    lastPayment,
  }
}

export function getInvoiceFinancialStatusLabel(status: InvoiceFinancialStatus): string {
  switch (status) {
    case 'pending': return 'Pendiente'
    case 'partially_paid': return 'Parcialmente cobrada'
    case 'paid': return 'Cobrada'
    case 'cancelled': return getStatusLabel('cancelled')
  }
}

export function getPaymentOriginLabel(originType: string | null | undefined): string {
  switch (originType) {
    case 'transfer_auto': return 'Automatico por transferencia'
    case 'transfer_regularization': return 'Regularizacion historica por transferencia'
    case 'manual': return 'Manual'
    default: return 'Manual'
  }
}

export function buildInvoicePaymentMeta(summary: InvoicePaymentSummary): string {
  if (!summary.lastPayment) return 'Sin cobros registrados'

  return `${getPaymentMethodLabel(summary.lastPayment.payment_method)} · ${getPaymentOriginLabel(summary.lastPayment.origin_type)}`
}
