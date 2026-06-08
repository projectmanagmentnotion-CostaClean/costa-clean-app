import { useEffect, useMemo, useState } from 'react'
import type { NavigationGuard } from '../app/navigationGuard'
import { ClientCreateForm } from '../features/clients/ClientCreateForm'
import { ClientWorkspace } from '../features/clients/ClientWorkspace'
import { ClientsList } from '../features/clients/ClientsList'
import {
  type ClientWorkspaceTab,
  useClientWorkspaceNavigation,
} from '../features/clients/useClientWorkspaceNavigation'
import type { ClientListItem } from '../features/clients/types'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PaymentListItem } from '../features/payments/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'

interface ClientsPageProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
  error: string | null
  onClientCreated: () => Promise<void>
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function ClientsPage({
  clients,
  properties,
  jobs,
  quotes,
  invoices,
  payments,
  recurringInvoicePlans,
  error,
  onClientCreated,
  onOpenPropertyWorkspace,
  onOpenJobWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onUnsavedChange,
  confirmNavigation,
}: ClientsPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasPendingWorkspaceState, setHasPendingWorkspaceState] = useState(false)
  const {
    activeClientId,
    activeTab,
    openClientWorkspace,
    closeClientWorkspace,
    setActiveTab,
  } = useClientWorkspaceNavigation(clients.map((client) => client.id))

  const activeClient = useMemo(
    () => clients.find((client) => client.id === activeClientId) ?? null,
    [activeClientId, clients],
  )
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en clientes')
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
      description: 'Hay cambios sin guardar en clientes. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  function handleOpenWorkspace(clientId: string, tab: ClientWorkspaceTab = 'summary') {
    runGuarded(() => {
      setShowCreateForm(false)
      openClientWorkspace(clientId, tab)
    })
  }

  return (
    <section className="page-section cc-master-page">
      {!activeClient ? (
        <>
          <div className="section-header page-header-actions cc-master-page__hero">
            <div>
              <h1>Clientes</h1>
              <p>La cartera ahora funciona como punto de entrada a workspaces de cliente persistentes.</p>
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
              {showCreateForm ? 'Cerrar formulario' : 'Nuevo cliente'}
            </button>
          </div>

          {showCreateForm ? (
            <ClientCreateForm
              onCreated={onClientCreated}
              onCancel={() => {
                setHasCreateFormDirty(false)
                setShowCreateForm(false)
              }}
              onDirtyChange={setHasCreateFormDirty}
            />
          ) : null}

          <div className="data-section">
            <div className="section-header page-header-actions">
              <div>
                <h2>Directorio de clientes</h2>
                <p>Haz clic en una tarjeta para abrir su workspace operativo completo.</p>
              </div>
            </div>

            <ClientsList
              clients={clients}
              error={error}
              selectedClientId={null}
              onSelectClient={(client) => handleOpenWorkspace(client.id)}
            />
          </div>
        </>
      ) : (
        <ClientWorkspace
          client={activeClient}
          properties={properties}
          jobs={jobs}
          quotes={quotes}
          invoices={invoices}
          payments={payments}
          recurringInvoicePlans={recurringInvoicePlans}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => {
            runGuarded(() => {
              setHasPendingWorkspaceState(false)
              closeClientWorkspace()
            })
          }}
          onRefresh={onClientCreated}
          onOpenPropertyWorkspace={onOpenPropertyWorkspace}
          onOpenJobWorkspace={onOpenJobWorkspace}
          onOpenQuoteDetail={onOpenQuoteDetail}
          onOpenInvoiceDetail={onOpenInvoiceDetail}
          onPendingStateChange={setHasPendingWorkspaceState}
        />
      )}
    </section>
  )
}
