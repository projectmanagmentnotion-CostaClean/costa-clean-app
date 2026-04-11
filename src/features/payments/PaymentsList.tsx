import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import type { PaymentListItem } from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'

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
  const defaultPreferences = useMemo(() => createDefaultPreferences('payment_date', 'desc', { method: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) =>
      (preferences.filters.method === 'all' || payment.payment_method === preferences.filters.method) &&
      matchesSearchQuery(preferences.searchQuery, [
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
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'code'
        ? compareText(left.display_code ?? left.id, right.display_code ?? right.id)
        : preferences.sortField === 'invoice'
          ? compareText(left.invoice_number ?? left.invoice_display_code ?? left.invoice_id, right.invoice_number ?? right.invoice_display_code ?? right.invoice_id)
          : preferences.sortField === 'amount'
            ? compareNumber(left.amount, right.amount)
            : preferences.sortField === 'method'
              ? compareText(getPaymentMethodLabel(left.payment_method), getPaymentMethodLabel(right.payment_method))
              : compareDate(left.payment_date, right.payment_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [payments, preferences])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Pagos</h2>
          <p>Cobros registrados y trazabilidad de factura asociada.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-payments"
        searchLabel="Buscar pago"
        searchPlaceholder="Código, factura, fecha, método o importe"
        resultCount={filteredPayments.length}
        totalCount={payments.length}
        sortOptions={[
          { value: 'payment_date', label: 'Fecha de cobro' },
          { value: 'code', label: 'Código' },
          { value: 'invoice', label: 'Factura' },
          { value: 'amount', label: 'Importe' },
          { value: 'method', label: 'Método' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'method',
          label: 'Método',
          value: preferences.filters.method ?? 'all',
          options: [
            { value: 'all', label: 'Todos' },
            { value: 'transfer', label: 'Transferencia' },
            { value: 'cash', label: 'Efectivo' },
            { value: 'bizum', label: 'Bizum' },
            { value: 'card', label: 'Tarjeta' },
          ],
        }]}
        onChange={setPreferences}
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
