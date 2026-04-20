import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { InvoiceListItem } from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'

interface InvoicesListProps {
  invoices: InvoiceListItem[]
  error: string | null
  selectedInvoiceId: string | null
  onSelectInvoice: (invoice: InvoiceListItem) => void
}

export function InvoicesList({
  invoices,
  error,
  selectedInvoiceId,
  onSelectInvoice,
}: InvoicesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('issue_date', 'desc', { status: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) =>
      (preferences.filters.status === 'all' || invoice.status === preferences.filters.status) &&
      matchesSearchQuery(preferences.searchQuery, [
        invoice.display_code,
        invoice.id,
        invoice.invoice_number,
        invoice.job_display_code,
        invoice.job_id,
        invoice.client_display_code,
        invoice.client_id,
        invoice.client_name,
        invoice.status,
        getStatusLabel(invoice.status),
        invoice.issue_date,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.total,
        invoice.notes,
      ]),
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'code'
        ? compareText(left.invoice_number ?? left.display_code ?? left.id, right.invoice_number ?? right.display_code ?? right.id)
        : preferences.sortField === 'client'
          ? compareText(left.client_name ?? left.client_display_code ?? left.client_id, right.client_name ?? right.client_display_code ?? right.client_id)
          : preferences.sortField === 'total'
            ? compareNumber(left.total, right.total)
            : preferences.sortField === 'status'
              ? compareText(getStatusLabel(left.status), getStatusLabel(right.status))
              : compareDate(left.issue_date, right.issue_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [invoices, preferences])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Facturas</h2>
          <p>Emision, cobro y trazabilidad documental.</p>
        </div>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-invoices"
        searchLabel="Buscar factura"
        searchPlaceholder="Número, código interno, servicio, cliente, estado o importe"
        resultCount={filteredInvoices.length}
        totalCount={invoices.length}
        sortOptions={[
          { value: 'issue_date', label: 'Fecha de emisión' },
          { value: 'code', label: 'Número / código' },
          { value: 'client', label: 'Cliente' },
          { value: 'total', label: 'Importe total' },
          { value: 'status', label: 'Estado' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'status',
          label: 'Estado',
          value: preferences.filters.status ?? 'all',
          options: [
            { value: 'all', label: 'Todos' },
            { value: 'draft', label: 'Borrador' },
            { value: 'issued', label: 'Emitida' },
            { value: 'paid', label: 'Pagada' },
            { value: 'cancelled', label: 'Cancelada' },
          ],
        }]}
        onChange={setPreferences}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando facturas</strong>
          <p>{error}</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <strong>No hay facturas</strong>
          <p>Todavía no existen facturas registradas en el sistema.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos facturas que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredInvoices.map((invoice) => {
            const isSelected = invoice.id === selectedInvoiceId

            return (
              <button
                key={invoice.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--invoice'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--invoice'
                }
                onClick={() => onSelectInvoice(invoice)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">
                      {invoice.invoice_number ?? invoice.display_code ?? invoice.id}
                    </strong>
                    <span className="cc-record-card__subref">
                      Interno {invoice.display_code ?? invoice.id}
                    </span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getStatusLabel(invoice.status)}</span>
                    <strong className="cc-record-card__amount">{formatCurrency(invoice.total)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">
                  {invoice.client_name ?? invoice.client_display_code ?? invoice.client_id}
                </p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>{invoice.issue_date}</span>
                  <span>{invoice.job_display_code ?? invoice.job_id ?? 'Desde presupuesto aceptado'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
