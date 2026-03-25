import { useMemo, useState } from 'react'
import { SearchBar } from '../../components/SearchBar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
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
        quote.subtotal,
        quote.tax_amount,
        quote.total,
        quote.notes,
      ]),
    )
  }, [quotes, searchQuery])

  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Listado de presupuestos</h2>
        <p>
          Consulta propuestas comerciales, estado, importes y relación con cliente o propiedad.
        </p>
      </div>

      <SearchBar
        label="Buscar presupuesto"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Código, cliente, propiedad, estado o importe"
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
                </div>

                <p>Cliente: {quote.client_display_code ?? quote.client_id}</p>
                <p>Propiedad: {quote.property_display_code ?? quote.property_id ?? 'Sin propiedad'}</p>
                <p>Estado: {getStatusLabel(quote.status)}</p>
                <p>Subtotal: {formatCurrency(quote.subtotal)}</p>
                <p>Total: {formatCurrency(quote.total)}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
