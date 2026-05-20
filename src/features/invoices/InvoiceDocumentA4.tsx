import './invoiceDocument.css'
import { businessRules } from '../../app/businessRules'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { InvoiceLineItem, InvoiceListItem } from './types'

interface InvoiceDocumentA4Props {
  invoice: InvoiceListItem
  variant?: 'document' | 'embedded' | 'print'
  logoSrc?: string
}

interface DocumentLine {
  id: string
  concept: string
  quantity: number
  unit: string | null
  unit_price: number
  line_subtotal: number
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
  return invoice.service_reference || invoice.quote_display_code || invoice.job_display_code || invoice.job_id || 'Factura desde presupuesto aceptado'
}

function normalizeUnit(value: string | null | undefined): string | null {
  const rawUnit = value?.trim()
  if (!rawUnit) return null
  return rawUnit === 'service' ? 'servicio' : rawUnit
}

function getBillingQuantity(invoice: InvoiceListItem): number {
  const quantity = Number(invoice.billing_quantity)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function getBillingUnitPrice(invoice: InvoiceListItem, quantity: number): number {
  const unitPrice = Number(invoice.billing_unit_price)
  if (Number.isFinite(unitPrice) && unitPrice >= 0) {
    return unitPrice
  }

  return quantity > 0 ? invoice.subtotal / quantity : invoice.subtotal
}

function getPersistedDocumentLines(invoice: InvoiceListItem): DocumentLine[] {
  const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []

  return [...lines]
    .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
    .map((line: InvoiceLineItem) => ({
      id: line.id,
      concept: normalizeLineConcept(line.concept),
      quantity: Number(line.quantity),
      unit: normalizeUnit(line.unit),
      unit_price: Number(line.unit_price),
      line_subtotal: Number(line.line_subtotal),
    }))
    .filter((line) => (
      Number.isFinite(line.quantity) &&
      line.quantity > 0 &&
      Number.isFinite(line.unit_price) &&
      Number.isFinite(line.line_subtotal)
    ))
}

function getDocumentLines(invoice: InvoiceListItem): DocumentLine[] {
  const persistedLines = getPersistedDocumentLines(invoice)
  if (persistedLines.length > 0) {
    return persistedLines
  }

  const quantity = getBillingQuantity(invoice)
  const unitPrice = getBillingUnitPrice(invoice, quantity)

  return [{
    id: `${invoice.id}-fallback-line`,
    concept: simplifyLineConcept(invoice.billing_concept || invoice.service_description),
    quantity,
    unit: normalizeUnit(invoice.billing_unit),
    unit_price: unitPrice,
    line_subtotal: invoice.subtotal,
  }]
}

function buildConcept(invoice: InvoiceListItem): string {
  return getDocumentLines(invoice)[0]?.concept || 'Servicio de limpieza'
}

function formatQuantity(line: DocumentLine): string {
  const formattedQuantity = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(line.quantity)

  return line.unit ? `${formattedQuantity} ${line.unit}` : formattedQuantity
}

export function InvoiceDocumentA4({
  invoice,
  variant = 'document',
  logoSrc = '/branding/logo-costa-clean-web.png',
}: InvoiceDocumentA4Props) {
  const clientMeta = buildClientMeta(invoice)
  const documentLines = getDocumentLines(invoice)

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
            src={logoSrc}
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
            {documentLines.map((line) => (
              <tr key={line.id}>
                <td>{line.concept}</td>
                <td>{formatQuantity(line)}</td>
                <td>{formatCurrency(line.unit_price)}</td>
                <td>{formatCurrency(line.line_subtotal)}</td>
              </tr>
            ))}
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
