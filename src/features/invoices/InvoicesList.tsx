import { useEffect, useMemo, useState } from 'react'
import { formatClientLabel, formatInvoiceLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { InvoiceListItem } from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'
import { getInvoiceFinancialStatusLabel } from './paymentState'

interface InvoicesListProps {
  invoices: InvoiceListItem[]
  error: string | null
  selectedInvoiceId: string | null
  selectedInvoiceIds?: string[]
  isSelectionMode?: boolean
  onSelectInvoice: (invoice: InvoiceListItem) => void
  onToggleInvoiceSelection?: (invoiceId: string) => void
  onOpenDocument: (invoice: InvoiceListItem) => void
  onStateChange?: (state: {
    visibleCount: number
    totalCount: number
    hasError: boolean
    searchQuery: string
    visibleInvoices: InvoiceListItem[]
  }) => void
}

export function InvoicesList({
  invoices,
  error,
  selectedInvoiceId,
  selectedInvoiceIds = [],
  isSelectionMode = false,
  onSelectInvoice,
  onToggleInvoiceSelection,
  onOpenDocument,
  onStateChange,
}: InvoicesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('issue_date', 'desc', { status: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) =>
      (
        preferences.filters.status === 'all'
        || (preferences.filters.status === 'draft' && invoice.status === 'draft')
        || (preferences.filters.status !== 'draft' && (invoice.payment_status ?? invoice.status) === preferences.filters.status)
      ) &&
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
        getInvoiceFinancialStatusLabel(invoice.payment_status ?? 'pending'),
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
          ? compareText(formatClientLabel(left), formatClientLabel(right))
          : preferences.sortField === 'total'
            ? compareNumber(left.total, right.total)
            : preferences.sortField === 'status'
              ? compareText(getStatusLabel(left.status), getStatusLabel(right.status))
              : compareDate(left.issue_date, right.issue_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [invoices, preferences])

  useEffect(() => {
    onStateChange?.({
      visibleCount: filteredInvoices.length,
      totalCount: invoices.length,
      hasError: Boolean(error),
      searchQuery: preferences.searchQuery,
      visibleInvoices: filteredInvoices,
    })
  }, [error, filteredInvoices, filteredInvoices.length, invoices.length, onStateChange, preferences.searchQuery])

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
            { value: 'pending', label: 'Pendiente' },
            { value: 'partially_paid', label: 'Parcialmente cobrada' },
            { value: 'paid', label: 'Cobrada' },
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
          <p>
            {preferences.searchQuery.trim()
              ? `No encontramos facturas para "${preferences.searchQuery.trim()}" con los filtros activos.`
              : 'No encontramos facturas con los filtros activos.'}
          </p>
        </div>
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredInvoices.map((invoice) => {
            const isSelected = invoice.id === selectedInvoiceId
            const isChecked = selectedInvoiceIds.includes(invoice.id)

            return (
              <article
                key={invoice.id}
                className={
                  isSelected
                    ? 'cc-record-card cc-record-card--invoice cc-record-card--compact is-selected'
                    : 'cc-record-card cc-record-card--invoice cc-record-card--compact'
                }
              >
                {isSelectionMode ? (
                  <label className="cc-record-card__selection" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleInvoiceSelection?.(invoice.id)}
                    />
                    <span>Seleccionar factura</span>
                  </label>
                ) : null}
                <button
                  type="button"
                  className="lead-item-button cc-record-card__primary"
                  onClick={() => onSelectInvoice(invoice)}
                >
                  <div className="cc-record-card__head">
                    <div className="cc-record-card__identity">
                      <strong className="cc-record-card__title">
                        {formatInvoiceLabel(invoice)}
                      </strong>
                      <span className="cc-record-card__subref">
                        {invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Sin origen operativo'}
                      </span>
                    </div>

                    <div className="cc-record-card__aside">
                      <span className={`lead-badge cc-status-badge cc-status-badge--${invoice.payment_status ?? invoice.status}`}>
                        {getInvoiceFinancialStatusLabel(invoice.payment_status ?? 'pending')}
                      </span>
                      <strong className="cc-record-card__amount">{formatCurrency(invoice.total)}</strong>
                    </div>
                  </div>

                  <p className="cc-record-card__summary">
                    {formatClientLabel(invoice)}
                  </p>

                  <div className="cc-record-card__chips" aria-label="Contexto de la factura">
                    <span className="cc-record-card__chip">{invoice.issue_date}</span>
                    <span className="cc-record-card__chip">
                      {invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Desde presupuesto aceptado'}
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
                        {invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Presupuesto aceptado'}
                      </span>
                    </span>
                  </div>
                </button>

                <div className="cc-record-card__footer">
                  <div className="cc-record-card__footer-actions">
                    <button
                      type="button"
                      className="cc-record-card__inline-action is-primary"
                      onClick={() => onSelectInvoice(invoice)}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="cc-record-card__inline-action"
                      onClick={() => onOpenDocument(invoice)}
                    >
                      Documento
                    </button>
                  </div>
                  {invoice.payment_status !== 'paid' ? (
                    <span className="cc-record-card__microhint">Pendiente {formatCurrency(invoice.outstanding_amount ?? invoice.total)}</span>
                  ) : (
                    <span className="cc-record-card__microhint">Cobro cerrado</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
