import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ExecutiveHeader } from '../components/ExecutiveHeader'
import { ModuleFilterBar } from '../components/ModuleFilterBar'
import { ActionFlowOverlay } from '../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../components/DeferredContentFallback'
import { VisualKpiCard } from '../components/VisualKpiCard'
import { formatCurrency } from '../app/displayFormat'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildPaymentDuplicateGroups } from '../features/duplicates/duplicateEngine'
import { PaymentDetailCard } from '../features/payments/PaymentDetailCard'
import { PaymentsList } from '../features/payments/PaymentsList'
import type { PaymentListItem } from '../features/payments/types'
import type { ClientListItem } from '../features/clients/types'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { InvoiceListItem } from '../features/invoices/types'
import type { JobListItem } from '../features/jobs/types'
import type { PropertyListItem } from '../features/properties/types'
import type { QuoteListItem } from '../features/quotes/types'
import type { NavigationGuard } from '../app/navigationGuard'
import { compactVisibleItems, hasMeaningfulAmount, hasMeaningfulCount } from '../shared/ui/visibilityRules'

const LazyPaymentCreateFlow = lazy(async () => ({
  default: (await import('../features/payments/PaymentCreateFlow')).PaymentCreateFlow,
}))

interface PaymentsPageProps {
  payments: PaymentListItem[]
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  error: string | null
  onPaymentCreated: () => Promise<void>
  onOpenInvoiceDetail: (invoiceId: string) => void
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  activeFilterLabel: string | null
  onClearFilter: () => void
  onUnsavedChange?: (hasUnsavedChanges: boolean, contextLabel?: string) => void
  confirmNavigation?: NavigationGuard
}

export function PaymentsPage({
  payments,
  invoices,
  clients,
  properties,
  jobs,
  quotes,
  error,
  onPaymentCreated,
  onOpenInvoiceDetail,
  onOpenClientWorkspace,
  activeFilterLabel,
  onClearFilter,
  onUnsavedChange,
  confirmNavigation,
}: PaymentsPageProps) {
  function sumMoney(values: number[]) {
    return Math.round((values.reduce((sum, value) => sum + value, 0) + Number.EPSILON) * 100) / 100
  }

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasCreateFormDirty, setHasCreateFormDirty] = useState(false)
  const [hasUnsavedDetailChanges, setHasUnsavedDetailChanges] = useState(false)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)

  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0] ?? null
  const selectedPaymentKey = selectedPayment?.id ?? null
  const hasPendingWork = hasCreateFormDirty || hasUnsavedDetailChanges
  const rawDuplicateGroups = buildPaymentDuplicateGroups(payments)
  const {
    visibleGroups: duplicateGroups,
    unresolvedGroups: unresolvedDuplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)
  const totalCollectedAmount = useMemo(
    () => sumMoney(payments.map((payment) => Number(payment.amount ?? 0))),
    [payments],
  )
  const invoicesWithPaymentsCount = useMemo(
    () => new Set(payments.map((payment) => payment.invoice_id)).size,
    [payments],
  )
  const manualPaymentsCount = useMemo(
    () => payments.filter((payment) => (payment.origin_type ?? 'manual') === 'manual').length,
    [payments],
  )
  const paymentsTargetInvoiceId = selectedPayment?.invoice_id ?? payments[0]?.invoice_id ?? null
  const summaryKpis = compactVisibleItems([
    hasMeaningfulCount(payments.length) ? (
      <VisualKpiCard
        key="payments-total"
        label="Cobros registrados"
        value={String(payments.length)}
        hint="Volumen total de cobros persistidos y disponibles para auditoria interna."
        tone="info"
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(invoicesWithPaymentsCount) ? (
      <VisualKpiCard
        key="payments-invoices"
        label="Facturas con cobro"
        value={String(invoicesWithPaymentsCount)}
        hint="Facturas distintas que ya tienen al menos un cobro asociado."
        tone="success"
        priority="compact"
      />
    ) : null,
    hasMeaningfulCount(manualPaymentsCount) ? (
      <VisualKpiCard
        key="payments-manual"
        label="Registro manual"
        value={String(manualPaymentsCount)}
        hint="Cobros introducidos manualmente. El resto viene de regularizacion o automatismo existente."
        tone="neutral"
        priority="compact"
      />
    ) : null,
  ])

  useEffect(() => {
    onUnsavedChange?.(hasPendingWork, 'cambios sin guardar en pagos')
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
      description: 'Hay cambios sin guardar en pagos. Si continúas, perderás esos cambios.',
      confirmLabel: 'Continuar',
    })
  }

  async function handlePaymentFlowCompleted() {
    setShowCreateForm(false)
    setHasCreateFormDirty(false)
  }

  return (
    <section className="page-section cc-master-page">
      <ExecutiveHeader
        eyebrow="Control auxiliar de cobros"
        title="Pagos"
        summary="Registro, trazabilidad y revision de cobros ya vinculados a factura. Esta vista acompana a Facturas y no compite con su prioridad principal."
        statusLabel={unresolvedDuplicateGroups.length > 0 ? `${unresolvedDuplicateGroups.length} duplicado(s) potencial(es)` : 'Control auxiliar'}
        statusTone={unresolvedDuplicateGroups.length > 0 ? 'warning' : 'info'}
        primaryAction={{
          label: showCreateForm ? 'Cerrar formulario' : 'Registrar cobro',
          onClick: () => {
            if (showCreateForm) {
              runGuarded(() => setShowCreateForm(false))
              return
            }

            setShowCreateForm(true)
          },
        }}
        secondaryAction={paymentsTargetInvoiceId ? {
          label: 'Abrir factura vinculada',
          onClick: () => onOpenInvoiceDetail(paymentsTargetInvoiceId),
        } : undefined}
        metricLabel={hasMeaningfulAmount(totalCollectedAmount) ? 'Cobro registrado' : undefined}
        metricValue={hasMeaningfulAmount(totalCollectedAmount) ? formatCurrency(totalCollectedAmount) : undefined}
        metricHint={hasMeaningfulAmount(totalCollectedAmount) ? 'Importe ya registrado en pagos. No representa previsiones ni conciliacion bancaria.' : undefined}
      />

      {summaryKpis.length > 0 ? (
        <div className="cc-kpi-grid cc-kpi-grid--compact">
          {summaryKpis}
        </div>
      ) : null}
      {/*
      <div className="section-header page-header-actions cc-master-page__hero">
        <div>
          <h1>Pagos</h1>
          <p>
            Usa esta vista para control y auditoría de cobros. El flujo primario debe arrancar desde la factura.
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
          {showCreateForm ? 'Cerrar formulario' : 'Registrar cobro'}
        </button>
      </div>
      */}

      {showCreateForm ? (
        <ActionFlowOverlay
          isOpen={showCreateForm}
          title="Registrar cobro"
          description="El cobro se registra en un flujo dedicado y al cerrar vuelves al mismo control de pagos."
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
                title="Cargando flujo de cobro"
                description="Preparando el registro completo del cobro."
              />
            )}
          >
            <LazyPaymentCreateFlow
              invoices={invoices}
              clients={clients}
              properties={properties}
              jobs={jobs}
              quotes={quotes}
              payments={payments}
              onRefreshData={onPaymentCreated}
              onCompleted={handlePaymentFlowCompleted}
              onOpenExistingPayment={(paymentId) => {
                setHasCreateFormDirty(false)
                setShowCreateForm(false)
                setSelectedPaymentId(paymentId)
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

      {unresolvedDuplicateGroups.length > 0 ? (
        <DuplicateNotice
          title={`${unresolvedDuplicateGroups.length} posibles cobros duplicados`}
          description="Se han detectado coincidencias por factura, fecha, importe o método. Revísalas sin ensuciar el control principal de cobros."
          actionLabel="Revisar duplicados"
          onAction={() => setShowDuplicateReview(true)}
        />
      ) : null}

      {activeFilterLabel ? (
        <ModuleFilterBar label={activeFilterLabel} onClear={onClearFilter} />
      ) : null}

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <PaymentsList
            payments={payments}
            error={error}
            selectedPaymentId={selectedPaymentKey}
            onOpenInvoiceDetail={onOpenInvoiceDetail}
            onSelectPayment={(payment) => {
              if (payment.id === selectedPaymentKey) return
              runGuarded(() => setSelectedPaymentId(payment.id))
            }}
          />
        </div>

        <div className="cc-master-layout__detail">
          <PaymentDetailCard
            payment={selectedPayment}
            payments={payments}
            invoices={invoices}
            onPaymentUpdated={onPaymentCreated}
            onOpenInvoiceDetail={onOpenInvoiceDetail}
            onOpenClientWorkspace={onOpenClientWorkspace}
            onUnsavedChange={setHasUnsavedDetailChanges}
            onOpenExistingPayment={(paymentId) => setSelectedPaymentId(paymentId)}
          />
        </div>
      </div>

      <DuplicateReviewOverlay
        isOpen={showDuplicateReview}
        title="Revisión de cobros duplicados"
        description="Estas coincidencias ya existen en el módulo y conviene revisarlas antes de seguir registrando cobros parecidos."
        groups={duplicateGroups}
        reviewStateByGroupId={reviewStateByGroupId}
        onMarkReviewed={markReviewed}
        onIgnoreGroup={ignoreGroup}
        onReopenGroup={reopenGroup}
        onClose={() => setShowDuplicateReview(false)}
        onOpenRecord={(paymentId) => {
          setShowDuplicateReview(false)
          setSelectedPaymentId(paymentId)
        }}
      />
    </section>
  )
}
