import '../invoices/invoiceDocument.css'
import { businessRules } from '../../app/businessRules'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'

interface QuoteDocumentA4Props {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  variant?: 'document' | 'embedded' | 'print'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: businessRules.currency,
  }).format(value)
}

function buildClientName(
  quote: QuoteListItem,
  clients: ClientListItem[],
): string {
  const client = clients.find((item) => item.id === quote.client_id)

  return (
    client?.full_name?.trim() ||
    quote.client_display_code ||
    quote.client_id
  )
}

function buildClientMeta(
  quote: QuoteListItem,
  clients: ClientListItem[],
): string[] {
  const client = clients.find((item) => item.id === quote.client_id)

  return [client?.phone, client?.email].filter(Boolean) as string[]
}

function buildPropertyName(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  if (!quote.property_id) return 'Sin propiedad vinculada'

  const property = properties.find((item) => item.id === quote.property_id)

  return (
    property?.name?.trim() ||
    quote.property_display_code ||
    quote.property_id
  )
}

function buildPropertyAddress(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  if (!quote.property_id) return 'Sin dirección vinculada'

  const property = properties.find((item) => item.id === quote.property_id)

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

function buildConcept(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  if (!quote.property_id) {
    return 'Servicio de limpieza'
  }

  const property = properties.find((item) => item.id === quote.property_id)

  if (!property) {
    return 'Servicio de limpieza'
  }

  const base = property.name?.trim() || property.display_code || property.id
  return `Servicio de limpieza en ${base}`
}

export function QuoteDocumentA4({
  quote,
  clients,
  properties,
  variant = 'document',
}: QuoteDocumentA4Props) {
  const articleClassName =
    variant === 'embedded'
      ? 'cc-invoice-a4 cc-invoice-a4--embedded'
      : variant === 'print'
        ? 'cc-invoice-a4 cc-invoice-a4--print'
        : 'cc-invoice-a4'

  const clientName = buildClientName(quote, clients)
  const clientMeta = buildClientMeta(quote, clients)
  const propertyName = buildPropertyName(quote, properties)
  const propertyAddress = buildPropertyAddress(quote, properties)
  const concept = buildConcept(quote, properties)

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
            <p>Documento comercial emitido conforme a las condiciones acordadas.</p>
          </div>
        </div>

        <div className="cc-invoice-a4__doc-box">
          <div className="cc-invoice-a4__doc-row">
            <span>Código</span>
            <strong>{quote.display_code ?? quote.id}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Estado</span>
            <strong>{quote.status}</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>Validez</span>
            <strong>{businessRules.defaultQuoteValidityDays} días</strong>
          </div>
          <div className="cc-invoice-a4__doc-row">
            <span>IVA</span>
            <strong>No incluido</strong>
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
          <span className="cc-invoice-a4__label">Servicio / referencia</span>
          <strong>{quote.display_code ?? quote.id}</strong>
          <p>{concept}</p>
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
            <tr>
              <td>{concept}</td>
              <td>1</td>
              <td>{formatCurrency(quote.subtotal)}</td>
              <td>{formatCurrency(quote.subtotal)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="cc-invoice-a4__footer-grid">
        <div className="cc-invoice-a4__notes">
          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Condiciones</span>
            <p>Validez del presupuesto: {businessRules.defaultQuoteValidityDays} días.</p>
            <p>{businessRules.defaultQuoteLegalNote}</p>
          </div>

          <div className="cc-invoice-a4__panel cc-invoice-a4__panel--soft">
            <span className="cc-invoice-a4__label">Observaciones</span>
            <p>{quote.notes?.trim() ? quote.notes : 'Sin observaciones adicionales.'}</p>
          </div>
        </div>

        <aside className="cc-invoice-a4__totals">
          <div className="cc-invoice-a4__total-row">
            <span>Base</span>
            <strong>{formatCurrency(quote.subtotal)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row">
            <span>IVA (21%)</span>
            <strong>{formatCurrency(quote.tax_amount ?? 0)}</strong>
          </div>

          <div className="cc-invoice-a4__total-row cc-invoice-a4__total-row--grand">
            <span>Total</span>
            <strong>{formatCurrency(quote.total)}</strong>
          </div>
        </aside>
      </section>
    </article>
  )
}
