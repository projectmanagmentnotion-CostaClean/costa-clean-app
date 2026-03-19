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
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Payments</h1>
          <p>Vista inicial del módulo Payments conectada a Supabase.</p>
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

      <PaymentDetailCard
        payment={selectedPayment}
        invoices={invoices}
        onPaymentUpdated={onPaymentCreated}
      />

      <PaymentsList
        payments={payments}
        error={error}
        selectedPaymentId={selectedPaymentId}
        onSelectPayment={(payment) => setSelectedPaymentId(payment.id)}
      />
    </section>
  )
}
