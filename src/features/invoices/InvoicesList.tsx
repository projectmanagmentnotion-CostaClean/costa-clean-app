import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { formatCurrency } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { matchesSearchQuery } from '../documents/search'
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
        invoice.invoice_number,
        invoice.display_code,
        invoice.id,
        invoice.client_display_code,
        invoice.client_id,
        invoice.client_name,
        invoice.job_display_code,
        invoice.job_id,
        invoice.status,
        getStatusLabel(invoice.status),
        invoice.total,
      ]),
    )
  }, [invoices, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Facturas</h2>
        <p>Listado conectado a Supabase.</p>
      </div>

      <SearchBar
        label="Buscar factura"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Número, código, cliente, servicio, estado o total"
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
          <p>Todavía no existen registros en la tabla invoices.</p>
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
                className={isSelected ? 'lead-item lead-item-button selected' : 'lead-item lead-item-button'}
                onClick={() => onSelectInvoice(invoice)}
              >
                <div className="lead-item-top">
                  <strong>{invoice.invoice_number ?? invoice.display_code ?? invoice.id}</strong>
                  <span className="lead-badge">{getStatusLabel(invoice.status)}</span>
                </div>

                <p>Código: {invoice.display_code ?? invoice.id}</p>
                <p>Cliente: {invoice.client_display_code ?? invoice.client_id}</p>
                <p>Total: {formatCurrency(invoice.total)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
