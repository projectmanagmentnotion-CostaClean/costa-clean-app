import { useEffect, useState } from 'react'
import { PaymentCreateForm } from '../features/payments/PaymentCreateForm'
import { PaymentDetailCard } from '../features/payments/PaymentDetailCard'
import { PaymentsList } from '../features/payments/PaymentsList'
import type { PaymentListItem } from '../features/payments/types'
import type { InvoiceListItem } from '../features/invoices/types'

interface PaymentsPageProps {
  payments: PaymentListItem[]
  invoices: InvoiceListItem[]
  error: string | null
  onPaymentCreated: () => Promise<void>
}

export function PaymentsPage({
  payments,
  invoices,
  error,
  onPaymentCreated,
}: PaymentsPageProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (payments.length === 0) {
      setSelectedPaymentId(null)
      return
    }

    const selectedStillExists = payments.some(
      (payment) => payment.id === selectedPaymentId,
    )

    if (!selectedStillExists) {
      setSelectedPaymentId(payments[0].id)
    }
  }, [payments, selectedPaymentId])

  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? null

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Pagos</h1>
          <p>
            Registra y consulta cobros con un patrón de lista y detalle más limpio.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo pago'}
        </button>
      </div>

      {showCreateForm ? (
        <PaymentCreateForm
          invoices={invoices}
          onCreated={onPaymentCreated}
        />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <PaymentsList
            payments={payments}
            error={error}
            selectedPaymentId={selectedPaymentId}
            onSelectPayment={(payment) => setSelectedPaymentId(payment.id)}
          />
        </div>

        <div className="cc-master-layout__detail">
          <PaymentDetailCard
            payment={selectedPayment}
            invoices={invoices}
            onPaymentUpdated={onPaymentCreated}
          />
        </div>
      </div>
    </section>
  )
}