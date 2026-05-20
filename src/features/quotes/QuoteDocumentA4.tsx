import '../invoices/invoiceDocument.css'
import { businessRules } from '../../app/businessRules'
import { getStatusLabel } from '../../app/displayText'
import type { QuoteLineItem, QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { normalizeLineConcept, simplifyLineConcept } from './lineConcepts'

interface QuoteDocumentA4Props {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  variant?: 'document' | 'embedded' | 'print'
}

interface DocumentLine {
  id: string
  concept: string
  quantity: number
  unit: string | null
  unit_price: number
  line_subtotal: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: businessRules.currency,
  }).format(value)
}

function formatQuantity(line: DocumentLine): string {
  const formattedQuantity = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(line.quantity)

  return line.unit ? `${formattedQuantity} ${line.unit}` : formattedQuantity
}

function normalizeUnit(value: string | null | undefined): string | null {
  const rawUnit = value?.trim()
  if (!rawUnit) return null
  return rawUnit === 'service' ? 'servicio' : rawUnit
}

function buildClientName(
  quote: QuoteListItem,
  clients: ClientListItem[],
): string {
  const client = clients.find((item) => item.id === quote.client_id)

  return client?.full_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Lead sin cliente'
}

function buildClientMeta(
  quote: QuoteListItem,
  clients: ClientListItem[],
): string[] {
  const client = clients.find((item) => item.id === quote.client_id)

  return [
    client?.phone,
    client?.email,
    quote.lead_display_code ? `Lead: ${quote.lead_display_code}` : null,
  ].filter(Boolean) as string[]
}

function getProperty(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): PropertyListItem | undefined {
  if (!quote.property_id) return undefined
  return properties.find((item) => item.id === quote.property_id)
}

function buildPropertyName(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  const property = getProperty(quote, properties)
  if (!quote.property_id) return 'Sin propiedad vinculada'

  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

function buildPropertyAddress(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  const property = getProperty(quote, properties)
  if (!quote.property_id) return 'Ubicación pendiente de concretar'

  if (!property) {
    return quote.property_display_code ?? quote.property_id
  }

  const parts = [
    property.address?.trim(),
    property.postal_code?.trim(),
    property.city?.trim(),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : property.display_code ?? property.id
}

function buildFallbackConcept(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  const property = getProperty(quote, properties)
  const propertyName = property?.name?.trim()

  if (propertyName) {
    return `Servicio de limpieza en ${propertyName}`
  }

  return simplifyLineConcept(quote.notes, 'Servicio de limpieza')
}

function getPersistedDocumentLines(quote: QuoteListItem): DocumentLine[] {
  const lines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []

  return [...lines]
    .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
    .map((line: QuoteLineItem) => ({
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

function getDocumentLines(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): DocumentLine[] {
  const persistedLines = getPersistedDocumentLines(quote)
  if (persistedLines.length > 0) {
    return persistedLines
  }

  return [{
    id: `${quote.id}-fallback-line`,
    concept: buildFallbackConcept(quote, properties),
    quantity: 1,
    unit: 'servicio',
    unit_price: quote.subtotal,
    line_subtotal: quote.subtotal,
  }]
}

function buildProposalReference(quote: QuoteListItem): string {
  return quote.display_code ?? `Presupuesto ${quote.id}`
}

export function QuoteDocumentA4({
  quote,
  clients,
  properties,
  variant = 'document',
}: QuoteDocumentA4Props) {
  const articleClassName =
    variant === 'embedded'
      ? 'cc-invoice-a4 cc-invoice-a4--embedded cc-invoice-a4--quote'
      : variant === 'print'
        ? 'cc-invoice-a4 cc-invoice-a4--print cc-invoice-a4--quote'
        : 'cc-invoice-a4 cc-invoice-a4--quote'

  const clientName = buildClientName(quote, clients)
  const clientMeta = buildClientMeta(quote, clients)
  const propertyName = buildPropertyName(quote, properties)
  const propertyAddress = buildPropertyAddress(quote, properties)
  const documentLines = getDocumentLines(quote, properties)
  const primaryConcept = documentLines[0]?.concept || 'Servicio de limpieza'

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
            <h1>PRESUPUESTO</h1>
            <p>Propuesta comercial preparada para su revisión y aprobación.</p>
          </div>
        </div>

        <div className="cc-invoice-a4__doc-box">
          <div className="cc-invoice-a4__doc-row">
            <span>Referencia comercial</span>
            <strong>{buildProposalReference(quote)}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Estado</span>
            <strong>{getStatusLabel(quote.status)}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Validez</span>
            <strong>{businessRules.defaultQuoteValidityDays} días</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Revisión económica</span>
            <strong>Total estimado con IVA</strong>
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
          <strong>{clientName}</strong>

          {clientMeta.map((line) => (
            <p key={line}>{line}</p>
          ))}

          {quote.client_display_code ? <p>Ref. CRM: {quote.client_display_code}</p> : null}
        </div>
      </section>

      <section className="cc-invoice-a4__references">
        <div className="cc-invoice-a4__reference-card">
          <span className="cc-invoice-a4__label">Alcance propuesto</span>
          <strong>{primaryConcept}</strong>
          <p>{buildProposalReference(quote)}</p>
        </div>

        <div className="cc-invoice-a4__reference-card">
          <span className="cc-invoice-a4__label">Propiedad / ubicación</span>
          <strong>{propertyName}</strong>
          <p>{propertyAddress}</p>
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
            <span className="cc-invoice-a4__label">Condiciones comerciales</span>
            <p>Validez del presupuesto: {businessRules.defaultQuoteValidityDays} días.</p>
            <p>{businessRules.defaultQuoteLegalNote}</p>
          </div>

          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Observaciones</span>
            <p>{quote.notes?.trim() ? quote.notes : 'Sin observaciones adicionales.'}</p>
          </div>

          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Siguiente paso</span>
            <p>La aceptación de este presupuesto permite planificar el servicio y emitir la factura posterior.</p>
          </div>
        </div>

        <aside className="cc-invoice-a4__totals">
          <div className="cc-invoice-a4__total-row">
            <span>Base estimada</span>
            <strong>{formatCurrency(quote.subtotal)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row">
            <span>IVA ({businessRules.defaultTaxRate * 100}%)</span>
            <strong>{formatCurrency(quote.tax_amount ?? 0)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row cc-invoice-a4__total-row--grand">
            <span>Total presupuesto</span>
            <strong>{formatCurrency(quote.total)}</strong>
          </div>
        </aside>
      </section>
    </article>
  )
}
