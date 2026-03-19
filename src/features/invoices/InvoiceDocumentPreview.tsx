import { businessRules } from '../../app/businessRules'
import type { InvoiceListItem } from './types'

interface InvoiceDocumentPreviewProps {
  invoice: InvoiceListItem | null
}

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: businessRules.currency,
  }).format(value)
}

export function InvoiceDocumentPreview({
  invoice,
}: InvoiceDocumentPreviewProps) {
  if (!invoice) {
    return (
      <section className="data-section">
        <div className="section-header">
          <h2>Plantilla de factura</h2>
          <p>Vista documental HTML/CSS de la factura seleccionada.</p>
        </div>

        <div className="empty-state">
          <strong>No hay factura para previsualizar</strong>
          <p>Selecciona una factura en el listado para ver la plantilla documental.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Plantilla de factura</h2>
        <p>Vista documental HTML/CSS de la factura seleccionada.</p>
      </div>

      <article className="invoice-document">
        <header className="invoice-document-header">
          <div>
            <span className="invoice-kicker">CostaClean</span>
            <h3>Factura</h3>
            <p className="invoice-document-muted">
              Documento comercial generado desde el CRM.
            </p>
          </div>

          <div className="invoice-document-meta">
            <div>
              <span className="invoice-meta-label">Número</span>
              <strong>{invoice.invoice_number ?? 'Sin número'}</strong>
            </div>

            <div>
              <span className="invoice-meta-label">Código interno</span>
              <strong>{invoice.display_code ?? invoice.id}</strong>
            </div>

            <div>
              <span className="invoice-meta-label">Fecha de emisión</span>
              <strong>{formatDate(invoice.issue_date)}</strong>
            </div>

            <div>
              <span className="invoice-meta-label">Estado</span>
              <strong>{invoice.status}</strong>
            </div>
          </div>
        </header>

        <section className="invoice-document-grid">
          <div className="invoice-box">
            <span className="invoice-meta-label">Emisor</span>
            <strong>CostaClean</strong>
            <p className="invoice-document-muted">
              Servicios de limpieza profesionales
            </p>
            <p className="invoice-document-muted">
              Barcelona, España
            </p>
          </div>

          <div className="invoice-box">
            <span className="invoice-meta-label">Cliente</span>
            <strong>{invoice.client_display_code ?? invoice.client_id}</strong>
            <p className="invoice-document-muted">
              Referencia cliente vinculada en el CRM
            </p>
          </div>
        </section>

        <section className="invoice-lines">
          <div className="invoice-lines-head">
            <span>Concepto</span>
            <span>Referencia</span>
            <span>Importe</span>
          </div>

          <div className="invoice-lines-row">
            <span>Servicio facturado</span>
            <span>{invoice.job_display_code ?? invoice.job_id}</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>
        </section>

        <section className="invoice-totals">
          <div className="invoice-total-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>

          <div className="invoice-total-row">
            <span>IVA</span>
            <strong>{formatCurrency(invoice.tax_amount)}</strong>
          </div>

          <div className="invoice-total-row invoice-total-row-grand">
            <span>Total</span>
            <strong>{formatCurrency(invoice.total)}</strong>
          </div>
        </section>

        <footer className="invoice-document-footer">
          <div className="invoice-box">
            <span className="invoice-meta-label">Observaciones</span>
            <p className="invoice-document-muted">
              {invoice.notes ?? 'Sin observaciones adicionales.'}
            </p>
          </div>

          <div className="invoice-box">
            <span className="invoice-meta-label">Nota legal</span>
            <p className="invoice-document-muted">
              {businessRules.defaultLegalNote}
            </p>
          </div>
        </footer>
      </article>
    </section>
  )
}
