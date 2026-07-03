import { useEffect, useMemo, useState } from 'react'
import type { NavigationGuard } from '../app/navigationGuard'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { VisualKpiCard } from '../components/VisualKpiCard'
import '../features/clients/clients-properties-polish.css'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildClientDuplicateGroups, buildRecurringPlanDuplicateGroups } from '../features/duplicates/duplicateEngine'
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
import { formatCurrency } from '../app/displayFormat'
import { isRecurringPlanDue } from '../features/recurringInvoices/recurringInvoiceSchedule'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import { DSPageHeader } from '../design-system/components/DSPageHeader'

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
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
  const [showRecurringDuplicateReview, setShowRecurringDuplicateReview] = useState(false)
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
  const rawDuplicateGroups = useMemo(() => buildClientDuplicateGroups(clients), [clients])
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const rawRecurringDuplicateGroups = useMemo(
    () => buildRecurringPlanDuplicateGroups(recurringInvoicePlans),
    [recurringInvoicePlans],
  )
  const {
    visibleGroups: recurringDuplicateGroups,
    reviewStateByGroupId: recurringReviewStateByGroupId,
    markReviewed: markRecurringReviewed,
    ignoreGroup: ignoreRecurringGroup,
    reopenGroup: reopenRecurringGroup,
  } = useDuplicateResolution(rawRecurringDuplicateGroups)
  const activeClientDuplicateGroups = useMemo(
    () => activeClient
      ? duplicateGroups.filter((group) => group.records.some((record) => record.recordId === activeClient.id))
      : [],
    [activeClient, duplicateGroups],
  )
  const activeClientImportantDuplicateGroups = useMemo(
    () => activeClientDuplicateGroups.filter((group) => group.severity === 'exact' || group.severity === 'strong'),
    [activeClientDuplicateGroups],
  )
  const activeClientRecurringDuplicateGroups = useMemo(
    () => activeClient
      ? recurringDuplicateGroups.filter((group) => group.records.some((record) => {
        const plan = recurringInvoicePlans.find((item) => item.id === record.recordId)
        return plan?.client_id === activeClient.id
      }))
      : [],
    [activeClient, recurringDuplicateGroups, recurringInvoicePlans],
  )
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState
  const invoicePaidById = useMemo(() => {
    const totals = new Map<string, number>()
    for (const payment of payments) {
      totals.set(payment.invoice_id, (totals.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0))
    }
    return totals
  }, [payments])
  const clientPendingBalances = useMemo(() => {
    const totals = new Map<string, number>()
    for (const invoice of invoices) {
      if (!invoice.client_id || invoice.status === 'cancelled') continue
      const paidAmount = Number(invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0)
      const pendingAmount = Math.max(Number(invoice.total ?? 0) - paidAmount, 0)
      if (pendingAmount <= 0.009) continue
      totals.set(invoice.client_id, (totals.get(invoice.client_id) ?? 0) + pendingAmount)
    }
    return totals
  }, [invoicePaidById, invoices])
  const clientsWithPendingBalance = useMemo(
    () => clients.filter((client) => (clientPendingBalances.get(client.id) ?? 0) > 0.009),
    [clientPendingBalances, clients],
  )
  const dueRecurringPlans = useMemo(
    () => recurringInvoicePlans.filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date)),
    [recurringInvoicePlans],
  )
  const clientsWithJobs = useMemo(
    () => new Set(jobs.map((job) => job.client_id)).size,
    [jobs],
  )
  const topPendingClient = clientsWithPendingBalance[0] ?? null

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
          <DSPageHeader
            eyebrow="Directorio operativo"
            title="Clientes"
            summary="Entrada rapida a workspaces, seguimiento comercial y saldo abierto visible solo cuando cambia la siguiente accion. Este modulo queda como superficie de acceso y contexto, no como dashboard pesado."
            statusLabel={clientsWithPendingBalance.length > 0 ? `${clientsWithPendingBalance.length} con saldo abierto` : 'Directorio estable'}
            statusTone={clientsWithPendingBalance.length > 0 ? 'warning' : 'info'}
            primaryAction={topPendingClient ? {
              label: 'Abrir cliente con pendiente',
              onClick: () => handleOpenWorkspace(topPendingClient.id, 'invoices'),
            } : {
              label: showCreateForm ? 'Cerrar formulario' : 'Nuevo cliente',
              onClick: () => {
                if (showCreateForm) {
                  runGuarded(() => setShowCreateForm(false))
                  return
                }

                setShowCreateForm(true)
              },
            }}
            secondaryAction={topPendingClient ? {
              label: showCreateForm ? 'Cerrar formulario' : 'Nuevo cliente',
              onClick: () => {
                if (showCreateForm) {
                  runGuarded(() => setShowCreateForm(false))
                  return
                }

                setShowCreateForm(true)
              },
            } : undefined}
            metricLabel="Saldo abierto visible"
            metricValue={formatCurrency(clientsWithPendingBalance.reduce((sum, client) => sum + Number(clientPendingBalances.get(client.id) ?? 0), 0))}
            metricHint={clientsWithPendingBalance.length > 0
              ? 'Importe agregado por cliente con factura pendiente visible.'
              : 'No hay clientes con saldo abierto dominando el directorio.'}
          />

          <div className="cc-kpi-grid cc-kpi-grid--compact">
            <VisualKpiCard
              label="Clientes activos"
              value={String(clients.filter((client) => client.status !== 'inactive').length)}
              hint="Cartera visible con ficha activa en el directorio."
              tone="info"
              priority="compact"
            />
            <VisualKpiCard
              label="Con saldo pendiente"
              value={String(clientsWithPendingBalance.length)}
              hint="Clientes que ya requieren abrir facturas o cobros."
              tone={clientsWithPendingBalance.length > 0 ? 'warning' : 'success'}
              priority="compact"
            />
            <VisualKpiCard
              label="Con servicios"
              value={String(clientsWithJobs)}
              hint="Clientes con operativa real ya conectada a servicios."
              tone="neutral"
              priority="compact"
            />
            <VisualKpiCard
              label="Planes recurrentes vencidos"
              value={String(dueRecurringPlans.length)}
              hint="Automatizaciones activas que ya piden revision o emision."
              tone={dueRecurringPlans.length > 0 ? 'warning' : 'neutral'}
              priority="compact"
            />
          </div>

          {duplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${duplicateGroups.length} grupo(s) de posibles clientes duplicados`}
              description="Se han detectado coincidencias por NIF/CIF, teléfono, email o ficha fiscal. Revísalas sin ensuciar la lista principal."
              actionLabel="Revisar duplicados"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

          {showCreateForm ? (
            <ActionFlowOverlay
              isOpen={showCreateForm}
              title="Nuevo cliente"
              description="Completa el alta sin perder el contexto de la cartera. Al cerrar volveras exactamente a esta vista."
              onClose={() => {
                runGuarded(() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                })
              }}
            >
              <ClientCreateForm
                onCreated={onClientCreated}
                existingClients={clients}
                onOpenExistingClient={(clientId) => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                  handleOpenWorkspace(clientId)
                }}
                onCancel={() => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                }}
                onDirtyChange={setHasCreateFormDirty}
              />
            </ActionFlowOverlay>
          ) : null}

          <div className="data-section cc-directory-page__list-shell">
            <div className="section-header page-header-actions">
              <div>
                <h2>Directorio de clientes</h2>
                <p>Abre una ficha para ver identidad, propiedades, documentos y siguiente accion sin saturar la portada.</p>
              </div>
            </div>

            <ClientsList
              clients={clients}
              error={error}
              selectedClientId={null}
              onSelectClient={(client) => handleOpenWorkspace(client.id)}
            />
          </div>

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Revisión de clientes duplicados"
            description="Estas coincidencias ya existen en la cartera y conviene resolverlas antes de crear o editar más fichas."
            groups={duplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
            onOpenRecord={(clientId) => {
              setShowDuplicateReview(false)
              handleOpenWorkspace(clientId)
            }}
          />
        </>
      ) : (
        <>
          {activeClientImportantDuplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${activeClientImportantDuplicateGroups.length} coincidencia(s) importante(s) en este cliente`}
              description="La ficha activa coincide con otro cliente relevante. Revisa el caso antes de seguir ampliando actividad sobre esta cuenta."
              actionLabel="Revisar coincidencias"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

          {activeClientRecurringDuplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${activeClientRecurringDuplicateGroups.length} plan(es) recurrente(s) con posible duplicado`}
              description="Este cliente tiene automatizaciones recurrentes que parecen repetidas por propiedad, cadencia o plantilla."
              actionLabel="Revisar recurrentes"
              onAction={() => setShowRecurringDuplicateReview(true)}
            />
          ) : null}

          <ClientWorkspace
            client={activeClient}
            allClients={clients}
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

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Coincidencias del cliente en este workspace"
            description="Estas coincidencias afectan a la ficha activa. Puedes marcarlas como revisadas o indicar que no son duplicados."
            groups={activeClientDuplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
            onOpenRecord={(clientId) => {
              setShowDuplicateReview(false)
              handleOpenWorkspace(clientId)
            }}
          />

          <DuplicateReviewOverlay
            isOpen={showRecurringDuplicateReview}
            title="Coincidencias recurrentes de este cliente"
            description="Estas automatizaciones parecen repetidas por cliente, propiedad, cadencia o importe plantilla."
            groups={activeClientRecurringDuplicateGroups}
            reviewStateByGroupId={recurringReviewStateByGroupId}
            onMarkReviewed={markRecurringReviewed}
            onIgnoreGroup={ignoreRecurringGroup}
            onReopenGroup={reopenRecurringGroup}
            onClose={() => setShowRecurringDuplicateReview(false)}
          />
        </>
      )}
    </section>
  )
}
