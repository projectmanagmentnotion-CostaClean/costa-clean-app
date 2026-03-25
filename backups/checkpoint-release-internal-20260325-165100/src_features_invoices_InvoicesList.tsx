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
    <section className="data-section">
      <div className="section-header">
        <h2>Listado de facturas</h2>
        <p>
          Consulta facturas emitidas, estado, servicio vinculado e importes principales.
        </p>
      </div>

      <SearchBar
        label="Buscar factura"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, número, servicio, cliente, estado o importe"
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
        <div className="lead-list">
          {filteredInvoices.map((invoice) => {
            const isSelected = invoice.id === selectedInvoiceId

            return (
              <button
                key={invoice.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectInvoice(invoice)}
              >
                <div className="lead-item-top">
                  <strong>{invoice.display_code ?? invoice.id}</strong>
                </div>

                <p>Número: {invoice.invoice_number ?? 'Sin número'}</p>
                <p>Servicio: {invoice.job_display_code ?? invoice.job_id}</p>
                <p>Cliente: {invoice.client_display_code ?? invoice.client_id}</p>
                <p>Estado: {getStatusLabel(invoice.status)}</p>
                <p>Fecha: {invoice.issue_date}</p>
                <p>Total: {formatCurrency(invoice.total)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
