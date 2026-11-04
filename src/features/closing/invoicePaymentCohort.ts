import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'

export interface InvoicePaymentCohort {
  payments: PaymentListItem[]
  paidAmountByInvoiceId: Map<string, number>
}

/**
 * Fiscal collection semantics: an invoice belongs to a period by issue date,
 * and its payments remain in that cohort regardless of payment date.
 */
export function buildInvoicePaymentCohort(
  payments: PaymentListItem[],
  periodInvoices: InvoiceListItem[],
): InvoicePaymentCohort {
  const invoiceIds = new Set(periodInvoices.map((invoice) => invoice.id))
  const cohortPayments = payments.filter((payment) => invoiceIds.has(payment.invoice_id))
  const paidAmountByInvoiceId = new Map<string, number>()

  for (const payment of payments) {
    paidAmountByInvoiceId.set(
      payment.invoice_id,
      (paidAmountByInvoiceId.get(payment.invoice_id) ?? 0) + Number(payment.amount || 0),
    )
  }

  return { payments: cohortPayments, paidAmountByInvoiceId }
}
