import { Suspense, lazy, useEffect, useState } from 'react'
import '../features/documents/documentSurfaceStyles'
import { ActionChecklist, type ActionChecklistItem } from '../components/ActionChecklist'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { MajorEditFlowOverlay } from '../components/MajorEditFlowOverlay'
import { ProgressMetric } from '../components/ProgressMetric'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildQuoteDuplicateGroups } from '../features/duplicates/duplicateEngine'
import { QuoteDetailCard } from '../features/quotes/QuoteDetailCard'
import { QuoteEditFlow } from '../features/quotes/QuoteEditFlow'
import { QuotesList } from '../features/quotes/QuotesList'
import type { QuoteListItem } from '../features/quotes/types'
import { formatCurrency } from '../app/displayFormat'
import type { ClientListItem } from '../features/clients/types'
import type { ExpenseListItem } from '../features/expenses/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { PropertyListItem } from '../features/properties/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { LazyQuoteDocumentScreen } from '../features/documents/lazyDocumentScreens'

const LazyQuoteCreateFlow = lazy(async () => ({
  default: (await import('../features/quotes/QuoteCreateFlow')).QuoteCreateFlow,
}))

interface QuotesPageProps {
  quotes: QuoteListItem[]
  allQuotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  expenses: ExpenseListItem[]
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
  allQuotes,
  invoices,
  expenses,
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
  const [showMajorEdit, setShowMajorEdit] = useState(false)
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)
  const [hasMajorEditDirty, setHasMajorEditDirty] = useState(false)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)

  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ?? quotes[0] ?? null
  const selectedQuoteKey = selectedQuote?.id ?? null

  const hasPendingWork = hasCreateFormDirty || hasUnsavedDetailChanges || hasMajorEditDirty
  const sentQuotes = quotes.filter((quote) => quote.status === 'sent')
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'accepted')
  const acceptedWithoutJob = acceptedQuotes.filter((quote) => !quote.job_id)
  const acceptedWithoutInvoice = acceptedQuotes.filter((quote) => !quote.invoice_id)
  const commercialPendingQuotes = quotes.filter((quote) => quote.status === 'draft' || quote.status === 'sent')
  const acceptedConvertedQuotes = acceptedQuotes.filter((quote) => Boolean(quote.job_id))
  const acceptedWithoutJobValue = acceptedWithoutJob.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0)
  const acceptedTotalValue = acceptedQuotes.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0)
  const funnelPercent = acceptedQuotes.length > 0
    ? Math.round((acceptedConvertedQuotes.length / acceptedQuotes.length) * 100)
    : 0
  const rawDuplicateGroups = buildQuoteDuplicateGroups(quotes)
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const actionTargetQuote = acceptedWithoutJob[0] ?? acceptedWithoutInvoice[0] ?? sentQuotes[0] ?? selectedQuote ?? null
  const quoteChecklistItems: ActionChecklistItem[] = [
    {
      id: 'accepted-without-job',
      state: acceptedWithoutJob.length > 0 ? 'warning' : 'done',
      label: `${acceptedWithoutJob.length} aceptado(s) sin servicio`,
      description: acceptedWithoutJob.length > 0
        ? 'Son presupuestos ya ganados que siguen sin pasar a operativa.'
        : 'No quedan aceptados pendientes de convertir a servicio.',
      action: acceptedWithoutJob[0] ? {
        label: 'Crear servicio',
        onClick: () => onCreateJobFromQuote(acceptedWithoutJob[0]),
      } : undefined,
    },
    {
      id: 'accepted-without-invoice',
      state: acceptedWithoutInvoice.length > 0 ? 'pending' : 'done',
      label: `${acceptedWithoutInvoice.length} aceptado(s) sin factura`,
      description: acceptedWithoutInvoice.length > 0
        ? 'Requieren abrir el presupuesto y decidir si ya toca facturar.'
        : 'No quedan aceptados sin enlace de factura visible.',
      action: acceptedWithoutInvoice[0] ? {
        label: 'Abrir presupuesto',
        onClick: () => setSelectedQuoteId(acceptedWithoutInvoice[0].id),
      } : undefined,
    },
    {
      id: 'follow-up',
      state: sentQuotes.length > 0 ? 'warning' : 'done',
      label: `${sentQuotes.length} enviado(s) por seguir`,
      description: sentQuotes.length > 0
        ? 'Siguen en decision comercial y conviene empujarlos antes de que se enfrien.'
        : 'No hay propuestas enviadas dominando la cola comercial.',
      action: sentQuotes[0] ? {
        label: 'Abrir enviado',
        onClick: () => setSelectedQuoteId(sentQuotes[0].id),
      } : undefined,
    },
    {
      id: 'duplicates',
      state: duplicateGroups.length > 0 ? 'warning' : 'done',
      label: `${duplicateGroups.length} duplicado(s) potencial(es)`,
      description: duplicateGroups.length > 0
        ? 'Conviene limpiar coincidencias antes de seguir generando propuestas parecidas.'
        : 'No hay duplicidades activas dominando la conversion.',
      action: duplicateGroups.length > 0 ? {
        label: 'Revisar duplicados',
        onClick: () => setShowDuplicateReview(true),
      } : undefined,
    },
  ]

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
    setHasCreateFormDirty(false)
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
        <ExecutiveHeader
          eyebrow="Propuesta y conversion"
          title="Presupuestos"
          summary="Seguimiento comercial, aceptaciones ganadas y conversion a operativa en una sola lectura. Lo prioritario es mover aceptados sin convertir y propuestas enviadas que siguen abiertas."
          statusLabel={acceptedWithoutJob.length > 0 ? `${acceptedWithoutJob.length} sin convertir` : 'Conversion estable'}
          statusTone={acceptedWithoutJob.length > 0 ? 'warning' : 'success'}
          primaryAction={acceptedWithoutJob[0] ? {
            label: 'Ver aceptados sin convertir',
            onClick: () => setSelectedQuoteId(acceptedWithoutJob[0].id),
          } : {
            label: showCreateForm ? 'Cerrar formulario' : 'Nuevo presupuesto',
            onClick: () => {
              if (showCreateForm) {
                runGuarded(() => setShowCreateForm(false))
                return
              }

              setShowCreateForm(true)
            },
          }}
          secondaryAction={acceptedWithoutJob[0]
            ? {
              label: showCreateForm ? 'Cerrar formulario' : 'Nuevo presupuesto',
              onClick: () => {
                if (showCreateForm) {
                  runGuarded(() => setShowCreateForm(false))
                  return
                }

                setShowCreateForm(true)
              },
            }
            : undefined}
          metricLabel="Potencial bloqueado"
          metricValue={formatCurrency(acceptedWithoutJobValue)}
          metricHint={acceptedWithoutJob.length > 0
            ? 'Importe aceptado que todavia no se ha convertido en servicio.'
            : 'No hay importe aceptado bloqueado por falta de servicio.'}
        >
          <div className="cc-fiscal-closing-header-progress">
            <ProgressMetric
              label="Aceptado -> servicio"
              value={`${funnelPercent}%`}
              percent={funnelPercent}
              tone={acceptedWithoutJob.length > 0 ? 'warning' : 'success'}
              hint={`${acceptedConvertedQuotes.length} de ${acceptedQuotes.length} aceptado(s) ya tienen servicio.`}
            />
            <ActionChecklist items={quoteChecklistItems} compact />
          </div>
        </ExecutiveHeader>

        <div className="cc-kpi-grid cc-kpi-grid--compact">
          <VisualKpiCard
            label="Pendientes de seguimiento"
            value={String(commercialPendingQuotes.length)}
            hint="Borradores y enviados que siguen pidiendo decision comercial."
            tone={commercialPendingQuotes.length > 0 ? 'warning' : 'neutral'}
            priority="compact"
            action={actionTargetQuote ? { label: 'Abrir', onClick: () => setSelectedQuoteId(actionTargetQuote.id) } : undefined}
          />
          <VisualKpiCard
            label="Aceptados"
            value={String(acceptedQuotes.length)}
            hint="Propuestas ya ganadas y listas para pasar a operativa o facturacion."
            tone="success"
            priority="compact"
          />
          <VisualKpiCard
            label="Aceptados sin convertir"
            value={String(acceptedWithoutJob.length)}
            hint="Aceptados que siguen sin servicio generado."
            tone={acceptedWithoutJob.length > 0 ? 'warning' : 'success'}
            priority="compact"
            badgeLabel={acceptedWithoutJob.length > 0 ? 'Accion' : 'Cubierto'}
          />
          <VisualKpiCard
            label="Valor aceptado"
            value={formatCurrency(acceptedTotalValue)}
            hint="Suma de presupuestos aceptados con importe real visible."
            tone="info"
            priority="compact"
          />
        </div>

        {showCreateForm ? (
          <ActionFlowOverlay
            isOpen={showCreateForm}
            title="Nuevo presupuesto"
            description="Trabaja el presupuesto en una superficie dedicada y vuelve a la lista sin perder el contexto."
            onClose={() => {
              runGuarded(() => {
                setHasCreateFormDirty(false)
                setShowCreateForm(false)
              })
            }}
          >
            <Suspense
              fallback={(
                <DeferredContentFallback
                  title="Cargando flujo de presupuesto"
                  description="Preparando el formulario comercial completo."
                />
              )}
            >
              <LazyQuoteCreateFlow
                clients={clients}
                properties={properties}
                quotes={allQuotes}
                invoices={invoices}
                expenses={expenses}
                onRefreshData={onQuoteCreated}
                onCompleted={handleQuoteCreated}
                onOpenExistingQuote={(quoteId) => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                  setSelectedQuoteId(quoteId)
                }}
                onCancel={() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                }}
                onDirtyChange={setHasCreateFormDirty}
              />
            </Suspense>
          </ActionFlowOverlay>
        ) : null}

        {duplicateGroups.length > 0 ? (
          <DuplicateNotice
            title={`${duplicateGroups.length} grupo(s) de posibles presupuestos duplicados`}
            description="Se han detectado coincidencias por cliente, propiedad y contexto económico. Revísalas desde una surface dedicada."
            actionLabel="Revisar duplicados"
            onAction={() => setShowDuplicateReview(true)}
          />
        ) : null}

        {selectedQuote ? (
          <MajorEditFlowOverlay
            isOpen={showMajorEdit}
            title="Editar presupuesto"
            description="La edicion mayor se resuelve fuera del panel de detalle y te devuelve al mismo presupuesto."
            onClose={() => {
              runGuarded(() => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              })
            }}
          >
            <QuoteEditFlow
              quote={selectedQuote}
              clients={clients}
              properties={properties}
              allQuotes={allQuotes}
              invoices={invoices}
              expenses={expenses}
              onRefreshData={onQuoteCreated}
              onOpenExistingQuote={(quoteId) => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
                setSelectedQuoteId(quoteId)
              }}
              onCompleted={async () => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              }}
              onCancel={() => {
                setShowMajorEdit(false)
                setHasMajorEditDirty(false)
              }}
              onDirtyChange={setHasMajorEditDirty}
            />
          </MajorEditFlowOverlay>
        ) : null}

        {activeFilterLabel ? (
          <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
        ) : null}

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
              onRequestMajorEdit={() => setShowMajorEdit(true)}
            />
          </div>
        </div>
      </section>

      <DuplicateReviewOverlay
        isOpen={showDuplicateReview}
        title="Revisión de presupuestos duplicados"
        description="Estas coincidencias ya existen en la app y conviene resolverlas antes de seguir creando o editando propuestas parecidas."
        groups={duplicateGroups}
        reviewStateByGroupId={reviewStateByGroupId}
        onMarkReviewed={markReviewed}
        onIgnoreGroup={ignoreGroup}
        onReopenGroup={reopenGroup}
        onClose={() => setShowDuplicateReview(false)}
        onOpenRecord={(quoteId) => {
          setShowDuplicateReview(false)
          setSelectedQuoteId(quoteId)
          setShowDocumentScreen(false)
        }}
      />

      {showDocumentScreen && selectedQuote ? (
        <Suspense
          fallback={(
            <DeferredContentFallback
              title="Cargando documento de presupuesto"
              description="Preparando la vista documental y las acciones de salida."
            />
          )}
        >
          <LazyQuoteDocumentScreen
            quote={selectedQuote}
            clients={clients}
            properties={properties}
            onClose={() => setShowDocumentScreen(false)}
          />
        </Suspense>
      ) : null}
    </>
  )
}
