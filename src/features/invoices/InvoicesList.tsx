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
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Facturas reales</h2>
        <p>Primer listado conectado a Supabase.</p>
      </div>

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
      ) : (
        <div className="lead-list">
          {invoices.map((invoice) => {
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
                  <span className="lead-badge">{invoice.status}</span>
                </div>

                <p>Código: {invoice.display_code ?? invoice.id}</p>
                <p>Client: {invoice.client_display_code ?? invoice.client_id}</p>
                <p>Total: {invoice.total}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
