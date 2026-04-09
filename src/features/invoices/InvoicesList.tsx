import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { InvoiceListItem } from './types'

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
  const [searchQuery, setSearchQuery] = useState('')

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) =>
      matchesSearchQuery(searchQuery, [
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
    )
  }, [invoices, searchQuery])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Facturas</h2>
          <p>Emision, cobro y trazabilidad documental.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar factura"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Número, código interno, servicio, cliente, estado o importe"
        resultCount={filteredInvoices.length}
        totalCount={invoices.length}
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
        <div className="lead-list cc-record-list">
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
                  <span>Servicio {invoice.job_display_code ?? invoice.job_id}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
