import { useEffect, useMemo, useState } from 'react'
import type { NavigationGuard } from '../app/navigationGuard'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import { PropertiesList } from '../features/properties/PropertiesList'
import { PropertyCreateFlow } from '../features/properties/PropertyCreateFlow'
import { PropertyWorkspace } from '../features/properties/PropertyWorkspace'
import { usePropertyWorkspaceNavigation } from '../features/properties/usePropertyWorkspaceNavigation'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'

interface PropertiesPageProps {
  properties: PropertyListItem[]
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  error: string | null
  onPropertyCreated: () => Promise<void>
  onOpenClientWorkspace: (clientId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function PropertiesPage({
  properties,
  clients,
  jobs,
  quotes,
  invoices,
  payments,
  error,
  onPropertyCreated,
  onOpenClientWorkspace,
  onOpenJobWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onUnsavedChange,
  confirmNavigation,
}: PropertiesPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasPendingWorkspaceState, setHasPendingWorkspaceState] = useState(false)
  const {
    activePropertyId,
    activeTab,
    openPropertyWorkspace,
    closePropertyWorkspace,
    setActiveTab,
  } = usePropertyWorkspaceNavigation(properties.map((property) => property.id))
  const activeProperty = useMemo(
    () => properties.find((property) => property.id === activePropertyId) ?? null,
    [activePropertyId, properties],
  )
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en propiedades')
    return () => onUnsavedChange?.(false)
  }, [hasPendingWork, onUnsavedChange])

  function runGuarded(action: () => void) {
    if (!hasPendingWork || !confirmNavigation) {
      action()
      return
    }

    confirmNavigation(action, {
      description: 'Hay cambios sin guardar en propiedades. Si continuas, perderas esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  return (
    <section className="page-section cc-master-page">
      {!activeProperty ? (
        <>
          <div className="section-header page-header-actions cc-master-page__hero">
            <div>
              <h1>Propiedades</h1>
              <p>La cartera de inmuebles ahora funciona como punto de entrada a workspaces persistentes por propiedad.</p>
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
              {showCreateForm ? 'Cerrar formulario' : 'Nueva propiedad'}
            </button>
          </div>

          {showCreateForm ? (
            <ActionFlowOverlay
              isOpen={showCreateForm}
              title="Nueva propiedad"
              description="La alta se abre como flujo dedicado y al cerrar volveras a la cartera de propiedades en el mismo punto."
              onClose={() => {
                runGuarded(() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                })
              }}
            >
              <PropertyCreateFlow
                clients={clients}
                onRefreshData={onPropertyCreated}
                onCompleted={async () => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                }}
                onCancel={() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                }}
                onDirtyChange={setHasCreateFormDirty}
              />
            </ActionFlowOverlay>
          ) : null}

          <div className="data-section">
            <div className="section-header page-header-actions">
              <div>
                <h2>Directorio de propiedades</h2>
                <p>Abre una propiedad para ver su estado operativo, documental y financiero en contexto.</p>
              </div>
            </div>

            <PropertiesList
              properties={properties}
              error={error}
              selectedPropertyId={null}
              onSelectProperty={(property) => {
                runGuarded(() => {
                  setShowCreateForm(false)
                  openPropertyWorkspace(property.id)
                })
              }}
            />
          </div>
        </>
      ) : (
        <PropertyWorkspace
          property={activeProperty}
          clients={clients}
          jobs={jobs}
          quotes={quotes}
          invoices={invoices}
          payments={payments}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => {
            runGuarded(() => {
              setHasPendingWorkspaceState(false)
              closePropertyWorkspace()
            })
          }}
          onRefresh={onPropertyCreated}
          onOpenClientWorkspace={onOpenClientWorkspace}
          onOpenJobWorkspace={onOpenJobWorkspace}
          onOpenQuoteDetail={onOpenQuoteDetail}
          onOpenInvoiceDetail={onOpenInvoiceDetail}
          onPendingStateChange={setHasPendingWorkspaceState}
        />
      )}
    </section>
  )
}
