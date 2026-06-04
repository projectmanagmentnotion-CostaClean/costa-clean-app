import { useEffect, useState } from 'react'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { QuoteCreateForm } from '../features/quotes/QuoteCreateForm'
import { QuoteDetailCard } from '../features/quotes/QuoteDetailCard'
import { QuoteDocumentScreen } from '../features/quotes/QuoteDocumentScreen'
import { QuotesList } from '../features/quotes/QuotesList'
import type { QuoteListItem } from '../features/quotes/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { formatCurrency } from '../app/displayFormat'

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
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)

  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ?? quotes[0] ?? null
  const selectedQuoteKey = selectedQuote?.id ?? null

  const hasPendingWork = showCreateForm || hasUnsavedDetailChanges
  const draftQuotesCount = quotes.filter((quote) => quote.status === 'draft').length
  const acceptedQuotesCount = quotes.filter((quote) => quote.status === 'accepted').length
  const selectedQuoteTotal = selectedQuote ? selectedQuote.total : null

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

  function openQuoteDocument(targetQuote: QuoteListItem) {
    runGuarded(() => {
      setSelectedQuoteId(targetQuote.id)
      setShowDocumentScreen(true)
    })
  }

  return (
    <>
      <section className="page-section cc-master-page cc-doc-page">
        <div className="section-header page-header-actions cc-master-page__hero">
          <div className="cc-module-hero__body">
            <span className="cc-module-hero__eyebrow">Propuesta y conversion</span>
            <h1>Presupuestos</h1>
            <p>
              Gestiona propuestas comerciales y abre el documento del presupuesto seleccionado.
            </p>

            <div className="cc-module-hero__meta" aria-label="Resumen del modulo presupuestos">
              <span className="cc-module-hero__metric">
                <strong>{quotes.length}</strong>
                <span>registros</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{draftQuotesCount}</strong>
                <span>borradores</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{acceptedQuotesCount}</strong>
                <span>aceptados</span>
              </span>
              <span className="cc-module-hero__metric">
                <strong>{selectedQuoteTotal !== null ? formatCurrency(selectedQuoteTotal) : ' - '}</strong>
                <span>seleccionado</span>
              </span>
            </div>
          </div>

          <div className="cc-module-hero__actions">
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

        <div className="cc-page-mode-strip">
          <span className="cc-page-mode-strip__pill cc-page-mode-strip__pill--active">Gestion</span>
          <span className="cc-page-mode-strip__text">Lista y detalle para trabajar el presupuesto</span>
        </div>

        <div className="cc-master-layout cc-master-layout--list-first cc-doc-workspace">
          <div className="cc-master-layout__list">
            <QuotesList
              quotes={quotes}
              clients={clients}
              properties={properties}
              error={error}
              selectedQuoteId={selectedQuoteKey}
              onOpenDocument={openQuoteDocument}
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
              onOpenDocument={() => {
                if (selectedQuote) {
                  openQuoteDocument(selectedQuote)
                }
              }}
              onCreateJobFromQuote={onCreateJobFromQuote}
              onUnsavedChange={setHasUnsavedDetailChanges}
            />
          </div>
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
