import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from './types'

interface QuotesListProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  selectedQuoteId: string | null
  onSelectQuote: (quote: QuoteListItem) => void
}

function buildClientLabel(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim() || quote.client_display_code || quote.client_id
}

function buildPropertyLabel(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

export function QuotesList({
  quotes,
  clients,
  properties,
  error,
  selectedQuoteId,
  onSelectQuote,
}: QuotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) =>
      matchesSearchQuery(searchQuery, [
        quote.display_code,
        buildClientLabel(quote, clients),
        quote.client_display_code,
        buildPropertyLabel(quote, properties),
        quote.property_display_code,
        quote.status,
        getStatusLabel(quote.status),
        quote.subtotal,
        quote.tax_amount,
        quote.total,
        quote.notes,
      ]),
    )
  }, [clients, properties, quotes, searchQuery])

  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Presupuestos</h2>
          <p>Seguimiento comercial y conversion operativa.</p>
        </div>
      </div>

      <SearchBar
        label="Buscar presupuesto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Referencia, cliente, propiedad, estado o importe"
        resultCount={filteredQuotes.length}
        totalCount={quotes.length}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando presupuestos</strong>
          <p>{error}</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <strong>No hay presupuestos</strong>
          <p>Todavía no existen presupuestos registrados en el sistema.</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos presupuestos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list cc-record-list">
          {filteredQuotes.map((quote) => {
            const isSelected = quote.id === selectedQuoteId
            const clientLabel = buildClientLabel(quote, clients)
            const propertyLabel = buildPropertyLabel(quote, properties)

            return (
              <button
                key={quote.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--quote'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--quote'
                }
                onClick={() => onSelectQuote(quote)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{quote.display_code ?? quote.id}</strong>
                    <span className="cc-record-card__subref">{propertyLabel}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getStatusLabel(quote.status)}</span>
                    <strong className="cc-record-card__amount">{formatCurrency(quote.total)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">{clientLabel}</p>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>Base {formatCurrency(quote.subtotal)}</span>
                  <span>Total {formatCurrency(quote.total)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
