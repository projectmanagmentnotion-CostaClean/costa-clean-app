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
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Pagos</h2>
          <p>Cobros registrados y trazabilidad de factura asociada.</p>
        </div>
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
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredPayments.map((payment) => {
            const isSelected = payment.id === selectedPaymentId

            return (
              <button
                key={payment.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--payment'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--payment'
                }
                onClick={() => onSelectPayment(payment)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">
                      {payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}
                    </strong>
                    <span className="cc-record-card__subref">Pago {payment.display_code ?? payment.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getPaymentMethodLabel(payment.payment_method)}</span>
                    <strong className="cc-record-card__amount">{formatCurrency(payment.amount)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">{formatDateEs(payment.payment_date)}</p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                  <span>{payment.notes?.trim() || 'Sin notas'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
