import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { formatCurrency } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { matchesSearchQuery } from '../documents/search'
import type { QuoteListItem } from './types'

interface QuotesListProps {
  quotes: QuoteListItem[]
  error: string | null
  selectedQuoteId: string | null
  onSelectQuote: (quote: QuoteListItem) => void
}

export function QuotesList({
  quotes,
  error,
  selectedQuoteId,
  onSelectQuote,
}: QuotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) =>
      matchesSearchQuery(searchQuery, [
        quote.display_code,
        quote.id,
        quote.client_display_code,
        quote.client_id,
        quote.property_display_code,
        quote.property_id,
        quote.status,
        getStatusLabel(quote.status),
        quote.total,
      ]),
    )
  }, [quotes, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Presupuestos</h2>
        <p>Listado conectado a Supabase.</p>
      </div>

      <SearchBar
        label="Buscar presupuesto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, cliente, propiedad, estado o total"
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
          <p>Todavía no existen registros en la tabla quotes.</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos presupuestos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="lead-list">
          {filteredQuotes.map((quote) => {
            const isSelected = quote.id === selectedQuoteId

            return (
              <button
                key={quote.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectQuote(quote)}
              >
                <div className="lead-item-top">
                  <strong>{quote.display_code ?? quote.id}</strong>
                  <span className="lead-badge">{getStatusLabel(quote.status)}</span>
                </div>

                <p>Cliente: {quote.client_display_code ?? quote.client_id}</p>
                <p>Propiedad: {quote.property_display_code ?? quote.property_id ?? 'Sin propiedad'}</p>
                <p>Total: {formatCurrency(quote.total)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
