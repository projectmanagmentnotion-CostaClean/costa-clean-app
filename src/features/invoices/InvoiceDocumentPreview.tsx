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
          <p>Vista documental HTML/CSS alineada con tu branding real.</p>
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
        <p>Vista documental HTML/CSS alineada con tu branding real.</p>
      </div>

      <article className="cc-invoice-preview">
        <header className="cc-invoice-preview__topbar">
          <span className="cc-invoice-preview__pill">CostaClean</span>

          <img
            src="/branding/logo-costa-clean-web.png"
            alt="CostaClean"
            className="cc-invoice-preview__logo"
          />
        </header>

        <section className="cc-invoice-preview__header">
          <div className="cc-invoice-preview__issuer-box">
            <span className="cc-invoice-preview__label">Datos del emisor</span>
            <strong>VILMA TIBISAY GARCÍA JIMÉNEZ</strong>
            <p>NIF: 60356434H</p>
            <p>C/Raval 35, 2-2</p>
            <p>08370 Barcelona</p>
          </div>

          <div className="cc-invoice-preview__doc-box">
            <span className="cc-invoice-preview__pill cc-invoice-preview__pill--light">
              Factura
            </span>

            <h3>FACTURA</h3>

            <div className="cc-invoice-preview__doc-meta">
              <div>
                <span className="cc-invoice-preview__label">Número</span>
                <strong>{invoice.invoice_number ?? 'Sin número'}</strong>
              </div>

              <div>
                <span className="cc-invoice-preview__label">Código interno</span>
                <strong>{invoice.display_code ?? invoice.id}</strong>
              </div>

              <div>
                <span className="cc-invoice-preview__label">Fecha de emisión</span>
                <strong>{formatDate(invoice.issue_date)}</strong>
              </div>

              <div>
                <span className="cc-invoice-preview__label">Estado</span>
                <strong>{invoice.status}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="cc-invoice-preview__meta-grid">
          <div className="cc-invoice-preview__card">
            <span className="cc-invoice-preview__label">Cliente</span>
            <strong>{invoice.client_display_code ?? invoice.client_id}</strong>
            <p>Cliente vinculado en CostaClean CRM</p>
            <p>Datos fiscales ampliables en siguientes fases</p>
          </div>

          <div className="cc-invoice-preview__card">
            <span className="cc-invoice-preview__label">Servicio / referencia</span>
            <strong>{invoice.job_display_code ?? invoice.job_id}</strong>
            <p>Factura generada desde servicio ejecutado</p>
          </div>
        </section>

        <section className="cc-invoice-preview__table">
          <div className="cc-invoice-preview__table-head">
            <span>Concepto</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Subtotal</span>
          </div>

          <div className="cc-invoice-preview__table-row">
            <span>Servicio de limpieza / trabajo facturado</span>
            <span>1</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>
        </section>

        <section className="cc-invoice-preview__bottom">
          <div className="cc-invoice-preview__notes-stack">
            <div className="cc-invoice-preview__card">
              <span className="cc-invoice-preview__label">Forma de pago</span>
              <p>Pago por transferencia a: IBAN ES32 0049 0183 6124 1084 6130</p>
            </div>

            <div className="cc-invoice-preview__card">
              <span className="cc-invoice-preview__label">Observaciones</span>
              <p>{invoice.notes ?? 'Sin observaciones adicionales.'}</p>
            </div>

            <div className="cc-invoice-preview__card">
              <span className="cc-invoice-preview__label">Nota legal</span>
              <p>{businessRules.defaultInvoiceLegalNote}</p>
            </div>
          </div>

          <div className="cc-invoice-preview__totals">
            <div className="cc-invoice-preview__total-row">
              <span>Base imponible</span>
              <strong>{formatCurrency(invoice.subtotal)}</strong>
            </div>

            <div className="cc-invoice-preview__total-row">
              <span>IVA (21%)</span>
              <strong>{formatCurrency(invoice.tax_amount)}</strong>
            </div>

            <div className="cc-invoice-preview__total-row cc-invoice-preview__total-row--grand">
              <span>Total</span>
              <strong>{formatCurrency(invoice.total)}</strong>
            </div>
          </div>
        </section>
      </article>
    </section>
  )
}

