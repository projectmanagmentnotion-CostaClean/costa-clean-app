import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
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
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  activeFilterLabel: string | null
  onClearFilter: () => void
}

export function QuotesPage({
  quotes,
  clients,
  properties,
  error,
  onQuoteCreated,
  onCreateJobFromQuote,
  activeFilterLabel,
  onClearFilter,
}: QuotesPageProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)
  const [isOpenDocumentConfirmVisible, setIsOpenDocumentConfirmVisible] = useState(false)

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

        {activeFilterLabel ? (
          <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
        ) : null}

        <div className="cc-master-layout cc-master-layout--list-first">
          <div className="cc-master-layout__list">
            <QuotesList
              quotes={quotes}
              clients={clients}
              properties={properties}
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
              onOpenDocument={() => setIsOpenDocumentConfirmVisible(true)}
              onCreateJobFromQuote={onCreateJobFromQuote}
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

      <ConfirmDialog
        isOpen={isOpenDocumentConfirmVisible && Boolean(selectedQuote)}
        title="Abrir vista de presupuesto"
        description="Se abrirá el presupuesto en una vista de documento para revisar, imprimir o guardar PDF. Continúa solo si quieres trabajar con este documento ahora."
        confirmLabel="Abrir presupuesto"
        onCancel={() => setIsOpenDocumentConfirmVisible(false)}
        onConfirm={() => {
          setIsOpenDocumentConfirmVisible(false)
          setShowDocumentScreen(true)
        }}
      />
    </>
  )
}
