import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import { formatInvoiceLabel, formatPaymentLabel, toUserFacingReference } from '../../app/relationshipLabels'
import { getPaymentOriginLabel } from '../../features/invoices/paymentState'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'

interface V3PaymentRowProps {
  payment: PaymentListItem
  invoice: InvoiceListItem | null
  clientName: string
  onOpen: () => void
}

export function V3PaymentRow({ payment, invoice, clientName, onOpen }: V3PaymentRowProps) {
  return (
    <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir ${formatPaymentLabel(payment)}`}>
      <div className="v3-payment-row__main">
        <strong>{formatCurrency(payment.amount)}</strong>
        <span>{invoice ? formatInvoiceLabel(invoice) : toUserFacingReference(payment.invoice_display_code) ?? 'Factura vinculada'}</span>
        <small>{clientName} · {formatDateEs(payment.payment_date)}</small>
      </div>
      <div className="v3-payment-row__side">
        <V3Status label={getPaymentMethodLabel(payment.payment_method)} tone="neutral" />
        <small>{getPaymentOriginLabel(payment.origin_type)}</small>
      </div>
    </V3EntityListItem>
  )
}
