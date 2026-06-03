import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import type { PaymentListItem } from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'
import { getPaymentOriginLabel } from '../invoices/paymentState'
import { OperationalListItem } from '../../components/OperationalListItem'

interface PaymentsListProps {
  payments: PaymentListItem[]
  error: string | null
  selectedPaymentId: string | null
  onSelectPayment: (payment: PaymentListItem) => void
  onOpenInvoiceDetail?: (invoiceId: string) => void
}

export function PaymentsList({
  payments,
  error,
  selectedPaymentId,
  onSelectPayment,
  onOpenInvoiceDetail,
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
        payment.origin_type,
        getPaymentOriginLabel(payment.origin_type),
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
        searchPlaceholder="Codigo, factura, fecha, metodo o importe"
        resultCount={filteredPayments.length}
        totalCount={payments.length}
        sortOptions={[
          { value: 'payment_date', label: 'Fecha de cobro' },
          { value: 'code', label: 'Codigo' },
          { value: 'invoice', label: 'Factura' },
          { value: 'amount', label: 'Importe' },
          { value: 'method', label: 'Metodo' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'method',
          label: 'Metodo',
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
          <p>Todavia no existen pagos registrados en el sistema.</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos pagos que coincidan con tu busqueda.</p>
        </div>
      ) : (
        <div className="cc-operational-list cc-bounded-list" role="listbox" aria-label="Lista de cobros">
          {filteredPayments.map((payment) => {
            const isSelected = payment.id === selectedPaymentId

            return (
              <OperationalListItem
                key={payment.id}
                selected={isSelected}
                onSelect={() => onSelectPayment(payment)}
                title={payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}
                subtitle={`Pago ${payment.display_code ?? payment.id}`}
                status={<span className="lead-badge">{getPaymentMethodLabel(payment.payment_method)}</span>}
                aside={<strong className="cc-record-card__amount">{formatCurrency(payment.amount)}</strong>}
                summary={formatDateEs(payment.payment_date)}
                chips={[getPaymentMethodLabel(payment.payment_method), getPaymentOriginLabel(payment.origin_type)]}
                meta={[
                  { label: 'Metodo', value: getPaymentMethodLabel(payment.payment_method) },
                  { label: 'Notas', value: payment.notes?.trim() || getPaymentOriginLabel(payment.origin_type) },
                ]}
                actions={[
                  {
                    key: 'open',
                    label: 'Abrir',
                    tone: 'primary',
                    onClick: () => onSelectPayment(payment),
                  },
                  {
                    key: 'invoice',
                    label: 'Factura',
                    onClick: () => onOpenInvoiceDetail?.(payment.invoice_id),
                  },
                ]}
                microhint={getPaymentOriginLabel(payment.origin_type)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
