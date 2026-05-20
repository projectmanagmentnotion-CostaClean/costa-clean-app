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
  onOpenDocument: (invoice: InvoiceListItem) => void
}

export function InvoicesList({
  invoices,
  error,
  selectedInvoiceId,
  onSelectInvoice,
  onOpenDocument,
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
        <span className="cc-list-section__count">
          {filteredInvoices.length} / {invoices.length}
        </span>
      </div>

      <ListToolbar
        storageKey="costaclean-list-preferences-invoices"
        searchLabel="Buscar factura"
        searchPlaceholder="Numero, codigo interno, servicio, cliente, estado o importe"
        resultCount={filteredInvoices.length}
        totalCount={invoices.length}
        sortOptions={[
          { value: 'issue_date', label: 'Fecha de emision' },
          { value: 'code', label: 'Numero / codigo' },
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
          <p>Todavia no existen facturas registradas en el sistema.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos facturas que coincidan con tu busqueda.</p>
        </div>
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredInvoices.map((invoice) => {
            const isSelected = invoice.id === selectedInvoiceId

            return (
              <article
                key={invoice.id}
                className={
                  isSelected
                    ? 'cc-record-card cc-record-card--invoice is-selected'
                    : 'cc-record-card cc-record-card--invoice'
                }
              >
                <button
                  type="button"
                  className="lead-item-button cc-record-card__primary"
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
                      <span className={`lead-badge cc-status-badge cc-status-badge--${invoice.status}`}>{getStatusLabel(invoice.status)}</span>
                      <strong className="cc-record-card__amount">{formatCurrency(invoice.total)}</strong>
                    </div>
                  </div>

                  <p className="cc-record-card__summary">
                    {invoice.client_name ?? invoice.client_display_code ?? invoice.client_id}
                  </p>

                  <div className="cc-record-card__chips" aria-label="Contexto de la factura">
                    <span className="cc-record-card__chip">{invoice.issue_date}</span>
                    <span className="cc-record-card__chip">
                      {invoice.job_display_code ?? invoice.job_id ?? 'Desde presupuesto aceptado'}
                    </span>
                  </div>

                  <div className="cc-list-meta cc-record-card__meta">
                    <span>
                      <span className="cc-record-card__meta-label">Emision</span>
                      <span className="cc-record-card__meta-value">{invoice.issue_date}</span>
                    </span>
                    <span>
                      <span className="cc-record-card__meta-label">Origen</span>
                      <span className="cc-record-card__meta-value">
                        {invoice.job_display_code ?? invoice.job_id ?? 'Presupuesto aceptado'}
                      </span>
                    </span>
                  </div>
                </button>

                <div className="cc-record-card__footer">
                  <button
                    type="button"
                    className="secondary-button cc-record-card__action"
                    onClick={() => onOpenDocument(invoice)}
                  >
                    Abrir documento
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
