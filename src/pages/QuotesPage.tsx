import { useEffect, useState } from 'react'
import { QuoteCreateForm } from '../features/quotes/QuoteCreateForm'
import { QuoteDetailCard } from '../features/quotes/QuoteDetailCard'
import { QuotesList } from '../features/quotes/QuotesList'
import type { QuoteListItem } from '../features/quotes/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'

interface QuotesPageProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  onQuoteCreated: () => Promise<void>
}

export function QuotesPage({
  quotes,
  clients,
  properties,
  error,
  onQuoteCreated,
}: QuotesPageProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (quotes.length === 0) {
      setSelectedQuoteId(null)
      return
    }

    const selectedStillExists = quotes.some(
      (quote) => quote.id === selectedQuoteId,
    )

    if (!selectedStillExists) {
      setSelectedQuoteId(quotes[0].id)
    }
  }, [quotes, selectedQuoteId])

  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ?? null

  return (
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Quotes</h1>
          <p>Vista inicial del módulo Quotes conectada a Supabase.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo quote'}
        </button>
      </div>

      {showCreateForm ? (
        <QuoteCreateForm
          clients={clients}
          properties={properties}
          onCreated={onQuoteCreated}
        />
      ) : null}

      <QuoteDetailCard
        quote={selectedQuote}
        clients={clients}
        properties={properties}
        onQuoteUpdated={onQuoteCreated}
      />

      <QuotesList
        quotes={quotes}
        error={error}
        selectedQuoteId={selectedQuoteId}
        onSelectQuote={(quote) => setSelectedQuoteId(quote.id)}
      />
    </section>
  )
}
