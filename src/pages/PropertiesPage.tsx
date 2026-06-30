import { useEffect, useMemo, useState } from 'react'
import type { NavigationGuard } from '../app/navigationGuard'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildPropertyDuplicateGroups } from '../features/duplicates/duplicateEngine'
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
import { formatCurrency } from '../app/displayFormat'

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
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
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
  const rawDuplicateGroups = useMemo(() => buildPropertyDuplicateGroups(properties), [properties])
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const activePropertyDuplicateGroups = useMemo(
    () => activeProperty
      ? duplicateGroups.filter((group) => group.records.some((record) => record.recordId === activeProperty.id))
      : [],
    [activeProperty, duplicateGroups],
  )
  const activePropertyImportantDuplicateGroups = useMemo(
    () => activePropertyDuplicateGroups.filter((group) => group.severity === 'exact' || group.severity === 'strong'),
    [activePropertyDuplicateGroups],
  )
  const hasPendingWork = hasCreateFormDirty || hasPendingWorkspaceState
  const invoicePaidById = useMemo(() => {
    const totals = new Map<string, number>()
    for (const payment of payments) {
      totals.set(payment.invoice_id, (totals.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0))
    }
    return totals
  }, [payments])
  const propertyPendingBalances = useMemo(() => {
    const totals = new Map<string, number>()
    for (const invoice of invoices) {
      if (!invoice.property_id || invoice.status === 'cancelled') continue
      const paidAmount = Number(invoice.paid_amount ?? invoicePaidById.get(invoice.id) ?? 0)
      const pendingAmount = Math.max(Number(invoice.total ?? 0) - paidAmount, 0)
      if (pendingAmount <= 0.009) continue
      totals.set(invoice.property_id, (totals.get(invoice.property_id) ?? 0) + pendingAmount)
    }
    return totals
  }, [invoicePaidById, invoices])
  const propertiesWithPendingBalance = useMemo(
    () => properties.filter((property) => (propertyPendingBalances.get(property.id) ?? 0) > 0.009),
    [properties, propertyPendingBalances],
  )
  const propertiesWithJobs = useMemo(
    () => new Set(jobs.map((job) => job.property_id)).size,
    [jobs],
  )
  const topPendingProperty = propertiesWithPendingBalance[0] ?? null

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
          <ExecutiveHeader
            eyebrow="Directorio de contexto"
            title="Propiedades"
            summary="Directorio compacto para abrir workspaces por inmueble y entrar rapido en servicios, presupuestos, facturas o cobros cuando ya existen. No compite con Home ni con los modulos de decision principal."
            statusLabel={propertiesWithPendingBalance.length > 0 ? `${propertiesWithPendingBalance.length} con saldo abierto` : 'Directorio estable'}
            statusTone={propertiesWithPendingBalance.length > 0 ? 'warning' : 'info'}
            primaryAction={topPendingProperty ? {
              label: 'Abrir propiedad con pendiente',
              onClick: () => {
                runGuarded(() => {
                  setShowCreateForm(false)
                  openPropertyWorkspace(topPendingProperty.id)
                })
              },
            } : {
              label: showCreateForm ? 'Cerrar formulario' : 'Nueva propiedad',
              onClick: () => {
                if (showCreateForm) {
                  runGuarded(() => setShowCreateForm(false))
                  return
                }

                setShowCreateForm(true)
              },
            }}
            secondaryAction={topPendingProperty ? {
              label: showCreateForm ? 'Cerrar formulario' : 'Nueva propiedad',
              onClick: () => {
                if (showCreateForm) {
                  runGuarded(() => setShowCreateForm(false))
                  return
                }

                setShowCreateForm(true)
              },
            } : undefined}
            metricLabel="Saldo abierto visible"
            metricValue={formatCurrency(propertiesWithPendingBalance.reduce((sum, property) => sum + Number(propertyPendingBalances.get(property.id) ?? 0), 0))}
            metricHint={propertiesWithPendingBalance.length > 0
              ? 'Importe agregado de propiedades con facturas pendientes visibles.'
              : 'No hay propiedades con saldo abierto dominando la cartera.'}
          />

          <div className="cc-kpi-grid cc-kpi-grid--compact">
            <VisualKpiCard
              label="Propiedades"
              value={String(properties.length)}
              hint="Volumen del directorio activo de inmuebles."
              tone="info"
              priority="compact"
            />
            <VisualKpiCard
              label="Con servicios"
              value={String(propertiesWithJobs)}
              hint="Propiedades con operativa real ya conectada."
              tone="neutral"
              priority="compact"
            />
            <VisualKpiCard
              label="Con saldo pendiente"
              value={String(propertiesWithPendingBalance.length)}
              hint="Inmuebles que ya requieren abrir facturas o cobros."
              tone={propertiesWithPendingBalance.length > 0 ? 'warning' : 'success'}
              priority="compact"
            />
            <VisualKpiCard
              label="Con presupuestos"
              value={String(new Set(quotes.map((quote) => quote.property_id).filter(Boolean)).size)}
              hint="Propiedades que ya tienen actividad comercial enlazada."
              tone="info"
              priority="compact"
            />
          </div>

          {duplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${duplicateGroups.length} grupo(s) de posibles propiedades duplicadas`}
              description="Se han detectado coincidencias por dirección o por inmueble repetido dentro del mismo cliente. Revísalas desde una surface específica."
              actionLabel="Revisar duplicados"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

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
                properties={properties}
                onRefreshData={onPropertyCreated}
                onCompleted={async () => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                }}
                onOpenExistingProperty={(propertyId) => {
                  setHasCreateFormDirty(false)
                  setShowCreateForm(false)
                  openPropertyWorkspace(propertyId)
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

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Revisión de propiedades duplicadas"
            description="Estas coincidencias ya existen en la cartera de inmuebles. Revísalas antes de seguir creando nuevas direcciones parecidas."
            groups={duplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
            onOpenRecord={(propertyId) => {
              setShowDuplicateReview(false)
              openPropertyWorkspace(propertyId)
            }}
          />
        </>
      ) : (
        <>
          {activePropertyImportantDuplicateGroups.length > 0 ? (
            <DuplicateNotice
              title={`${activePropertyImportantDuplicateGroups.length} coincidencia(s) importante(s) en esta propiedad`}
              description="La direccion o el contexto del inmueble activo coincide con otra propiedad relevante."
              actionLabel="Revisar coincidencias"
              onAction={() => setShowDuplicateReview(true)}
            />
          ) : null}

          <PropertyWorkspace
            property={activeProperty}
            allProperties={properties}
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

          <DuplicateReviewOverlay
            isOpen={showDuplicateReview}
            title="Coincidencias de esta propiedad"
            description="Estas coincidencias afectan al inmueble activo. Puedes revisarlas y dejar trazabilidad minima sin fusionar datos."
            groups={activePropertyDuplicateGroups}
            reviewStateByGroupId={reviewStateByGroupId}
            onMarkReviewed={markReviewed}
            onIgnoreGroup={ignoreGroup}
            onReopenGroup={reopenGroup}
            onClose={() => setShowDuplicateReview(false)}
          />
        </>
      )}
    </section>
  )
}
