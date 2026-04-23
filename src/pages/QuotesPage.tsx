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
import type { NavigationGuard } from '../app/navigationGuard'

interface QuotesPageProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  onQuoteCreated: () => Promise<void>
  onCreateJobFromQuote: (quote: QuoteListItem) => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
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
  onUnsavedChange,
  confirmNavigation,
}: QuotesPageProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDocumentScreen, setShowDocumentScreen] = useState(false)
  const [isOpenDocumentConfirmVisible, setIsOpenDocumentConfirmVisible] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ?? quotes[0] ?? null
  const selectedQuoteKey = selectedQuote?.id ?? null

  const hasPendingWork = showCreateForm || hasUnsavedDetailChanges

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en presupuestos')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork) {
      action()
      return
    }

    if (!confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en presupuestos. Si continuas, perderas esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handleQuoteCreated() {
    await onQuoteCreated()
    setShowCreateForm(false)
  }

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
            onClick={() => {
              if (showCreateForm) {
                runGuarded(() => setShowCreateForm(false))
                return
              }

              setShowCreateForm(true)
            }}
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nuevo presupuesto'}
          </button>
        </div>

        {showCreateForm ? (
          <QuoteCreateForm
            clients={clients}
            properties={properties}
            onCreated={handleQuoteCreated}
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
              selectedQuoteId={selectedQuoteKey}
              onSelectQuote={(quote) => {
                if (quote.id === selectedQuoteKey) return

                runGuarded(() => {
                  setSelectedQuoteId(quote.id)
                  setShowDocumentScreen(false)
                })
              }}
            />
          </div>

          <div className="cc-master-layout__detail">
            <QuoteDetailCard
              quote={selectedQuote}
              clients={clients}
              properties={properties}
              onQuoteUpdated={onQuoteCreated}
              onOpenDocument={() => runGuarded(() => setIsOpenDocumentConfirmVisible(true))}
              onCreateJobFromQuote={onCreateJobFromQuote}
              onUnsavedChange={setHasUnsavedDetailChanges}
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
        description="Se abrira el presupuesto en una vista de documento para revisar, imprimir o guardar PDF. Continua solo si quieres trabajar con este documento ahora."
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
