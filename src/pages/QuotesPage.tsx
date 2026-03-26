import { useEffect, useState } from 'react'
import { QuoteCreateForm } from '../features/quotes/QuoteCreateForm'
import { QuoteDetailCard } from '../features/quotes/QuoteDetailCard'
import { QuoteDocumentPreview } from '../features/quotes/QuoteDocumentPreview'
import { QuoteDocumentScreen } from '../features/quotes/QuoteDocumentScreen'
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
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)

  useEffect(() => {
    if (quotes.length === 0) {
      setSelectedQuoteId(null)
      setShowDocumentScreen(false)
      return
    }

    const selectedStillExists = quotes.some(
      (quote) => quote.id === selectedQuoteId,
    )

    if (!selectedStillExists) {
      setSelectedQuoteId(quotes[0].id)
      setShowDocumentScreen(false)
    }
  }, [quotes, selectedQuoteId])

  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ?? null

  return (
    <>
      <section className="page-section cc-master-page cc-doc-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div>
            <h1>Presupuestos</h1>
            <p>
              Gestiona propuestas comerciales y abre el documento del presupuesto seleccionado.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nuevo presupuesto'}
          </button>
        </div>

        {showCreateForm ? (
          <QuoteCreateForm
            clients={clients}
            properties={properties}
            onCreated={onQuoteCreated}
          />
        ) : null}

        <div className="cc-master-layout cc-master-layout--list-first">
          <div className="cc-master-layout__list">
            <QuotesList
              quotes={quotes}
              error={error}
              selectedQuoteId={selectedQuoteId}
              onSelectQuote={(quote) => {
                setSelectedQuoteId(quote.id)
                setShowDocumentScreen(false)
              }}
            />
          </div>

          <div className="cc-master-layout__detail">
            <QuoteDetailCard
              quote={selectedQuote}
              clients={clients}
              properties={properties}
              onQuoteUpdated={onQuoteCreated}
              onOpenDocument={() => setShowDocumentScreen(true)}
            />
          </div>
        </div>

        <div className="cc-doc-preview-panel">
          <QuoteDocumentPreview
            quote={selectedQuote}
            clients={clients}
            properties={properties}
          />
        </div>
      </section>

      {showDocumentScreen && selectedQuote ? (
        <QuoteDocumentScreen
          quote={selectedQuote}
          clients={clients}
          properties={properties}
          onClose={() => setShowDocumentScreen(false)}
        />
      ) : null}
    </>
  )
}