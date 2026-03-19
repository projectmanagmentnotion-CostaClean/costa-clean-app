import type { PaymentListItem } from './types'

interface PaymentsListProps {
  payments: PaymentListItem[]
  error: string | null
  selectedPaymentId: string | null
  onSelectPayment: (payment: PaymentListItem) => void
}

export function PaymentsList({
  payments,
  error,
  selectedPaymentId,
  onSelectPayment,
}: PaymentsListProps) {
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Pagos reales</h2>
        <p>Primer listado conectado a Supabase.</p>
      </div>

      {error ? (
        <div className="empty-state">
          <strong>Error cargando pagos</strong>
          <p>{error}</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <strong>No hay pagos</strong>
          <p>Todavía no existen registros en la tabla payments.</p>
        </div>
      ) : (
        <div className="lead-list">
          {payments.map((payment) => {
            const isSelected = payment.id === selectedPaymentId

            return (
              <button
                key={payment.id}
                type="button"
                className={isSelected ? 'lead-item lead-item-button selected' : 'lead-item lead-item-button'}
                onClick={() => onSelectPayment(payment)}
              >
                <div className="lead-item-top">
                  <strong>{payment.display_code ?? payment.id}</strong>
                </div>

                <p>Factura: {payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</p>
                <p>Fecha: {payment.payment_date}</p>
                <p>Importe: {payment.amount}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
