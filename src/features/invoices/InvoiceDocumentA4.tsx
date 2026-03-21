import './invoiceDocument.css'
import { businessRules } from '../../app/businessRules'
import type { InvoiceListItem } from './types'

interface InvoiceDocumentA4Props {
  invoice: InvoiceListItem
  variant?: 'document' | 'embedded' | 'print'
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

function buildClientTitle(invoice: InvoiceListItem): string {
  return invoice.client_name?.trim() || invoice.client_display_code || invoice.client_id
}

function buildClientMeta(invoice: InvoiceListItem): string[] {
  return [invoice.client_phone, invoice.client_email].filter(Boolean) as string[]
}

function buildReferenceTitle(invoice: InvoiceListItem): string {
  return invoice.service_reference || invoice.job_display_code || invoice.job_id
}

function buildConcept(invoice: InvoiceListItem): string {
  return invoice.service_description || 'Servicio de limpieza'
}

export function InvoiceDocumentA4({
  invoice,
  variant = 'document',
}: InvoiceDocumentA4Props) {
  const clientMeta = buildClientMeta(invoice)

  const articleClassName =
    variant === 'embedded'
      ? 'cc-invoice-a4 cc-invoice-a4--embedded'
      : variant === 'print'
        ? 'cc-invoice-a4 cc-invoice-a4--print'
        : 'cc-invoice-a4'

  return (
    <article className={articleClassName}>
      <header className="cc-invoice-a4__header">
        <div className="cc-invoice-a4__brand">
          <img
            src="/branding/logo-costa-clean-web.png"
            alt="CostaClean"
            className="cc-invoice-a4__logo"
          />

          <div className="cc-invoice-a4__brand-copy">
            <span className="cc-invoice-a4__eyebrow">CostaClean BCN</span>
            <h1>FACTURA</h1>
            <p>Documento fiscal emitido conforme a las condiciones acordadas.</p>
          </div>
        </div>

        <div className="cc-invoice-a4__doc-box">
          <div className="cc-invoice-a4__doc-row">
            <span>Número</span>
            <strong>{invoice.invoice_number ?? 'Sin número'}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Código interno</span>
            <strong>{invoice.display_code ?? invoice.id}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Fecha de emisión</span>
            <strong>{formatDate(invoice.issue_date)}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Estado</span>
            <strong>{invoice.status}</strong>
          </div>
        </div>
      </header>

      <section className="cc-invoice-a4__parties">
        <div className="cc-invoice-a4__panel">
          <span className="cc-invoice-a4__label">Emisor</span>
          <strong>VILMA TIBISAY GARCÍA JIMÉNEZ</strong>
          <p>NIF: 60356434H</p>
          <p>C/Raval 35, 2-2</p>
          <p>08370 Barcelona</p>
        </div>

        <div className="cc-invoice-a4__panel">
          <span className="cc-invoice-a4__label">Cliente</span>
          <strong>{buildClientTitle(invoice)}</strong>

          {clientMeta.map((line) => (
            <p key={line}>{line}</p>
          ))}

          {invoice.client_name && invoice.client_display_code ? (
            <p>Ref. CRM: {invoice.client_display_code}</p>
          ) : null}
        </div>
      </section>

      <section className="cc-invoice-a4__references">
        <div className="cc-invoice-a4__reference-card">
          <span className="cc-invoice-a4__label">Servicio / referencia</span>
          <strong>{buildReferenceTitle(invoice)}</strong>
          <p>{buildConcept(invoice)}</p>
        </div>

        <div className="cc-invoice-a4__reference-card">
          <span className="cc-invoice-a4__label">Propiedad / ubicación</span>
          <strong>{invoice.property_name ?? invoice.property_display_code ?? 'Sin propiedad vinculada'}</strong>
          <p>{invoice.property_address_line ?? 'Dirección ampliable en siguientes fases'}</p>
        </div>
      </section>

      <section className="cc-invoice-a4__table-wrap">
        <table className="cc-invoice-a4__table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{buildConcept(invoice)}</td>
              <td>1</td>
              <td>{formatCurrency(invoice.subtotal)}</td>
              <td>{formatCurrency(invoice.subtotal)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="cc-invoice-a4__footer-grid">
        <div className="cc-invoice-a4__notes">
          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Forma de pago</span>
            <p>Transferencia bancaria</p>
            <p>IBAN ES32 0049 0183 6124 1084 6130</p>
          </div>

          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Observaciones</span>
            <p>{invoice.notes?.trim() ? invoice.notes : 'Sin observaciones adicionales.'}</p>
          </div>

          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Nota legal</span>
            <p>{businessRules.defaultInvoiceLegalNote}</p>
          </div>
        </div>

        <aside className="cc-invoice-a4__totals">
          <div className="cc-invoice-a4__total-row">
            <span>Base imponible</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row">
            <span>IVA (21%)</span>
            <strong>{formatCurrency(invoice.tax_amount)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row cc-invoice-a4__total-row--grand">
            <span>Total</span>
            <strong>{formatCurrency(invoice.total)}</strong>
          </div>
        </aside>
      </section>
    </article>
  )
}
