import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
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
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) =>
      matchesSearchQuery(searchQuery, [
        payment.display_code,
        payment.id,
        payment.invoice_display_code,
        payment.invoice_number,
        payment.invoice_id,
        payment.payment_date,
        payment.amount,
        payment.payment_method,
        getPaymentMethodLabel(payment.payment_method),
        payment.notes,
      ]),
    )
  }, [payments, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Listado de pagos</h2>
        <p>
          Consulta cobros registrados, factura vinculada, fecha, importe y método de pago.
        </p>
      </div>

      <SearchBar
        label="Buscar pago"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, factura, fecha, método o importe"
        resultCount={filteredPayments.length}
        totalCount={payments.length}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando pagos</strong>
          <p>{error}</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <strong>No hay pagos</strong>
          <p>Todavía no existen pagos registrados en el sistema.</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos pagos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list">
          {filteredPayments.map((payment) => {
            const isSelected = payment.id === selectedPaymentId

            return (
              <button
                key={payment.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectPayment(payment)}
              >
                <div className="lead-item-top">
                  <strong>{payment.display_code ?? payment.id}</strong>
                </div>

                <p>Factura: {payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</p>
                <p>Fecha: {formatDateEs(payment.payment_date)}</p>
                <p>Importe: {formatCurrency(payment.amount)}</p>
                <p>Método: {getPaymentMethodLabel(payment.payment_method)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
