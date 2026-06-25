import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  formatCurrency,
  formatDateEs,
  getDisplayStatusLabel,
  getServiceTypeLabel,
} from '../../app/displayFormat'
import {
  formatClientLabel,
  formatInvoiceLabel,
  formatJobLabel,
  formatPropertyLabel,
  formatQuoteLabel,
} from '../../app/relationshipLabels'
import { buildInvoiceCreatePrefillFromJob } from '../invoices/invoiceCreatePrefill'
import { buildInvoicePaymentSummary, getInvoiceFinancialStatusLabel } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import type { PaymentListItem } from '../payments/types'
import { buildJobTimelineItems, type RelationshipTimelineItem } from '../relationships/timeline'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import '../workspaces/workspaceSurfaceStyles'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { DeferredContentFallback } from '../../components/DeferredContentFallback'
import { MajorEditFlowOverlay } from '../../components/MajorEditFlowOverlay'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from '../quotes/types'
import { JobDetailCard } from './JobDetailCard'
import type { JobListItem } from './types'
import type { JobWorkspaceTab } from './useJobWorkspaceNavigation'
import { jobWorkspaceTabs } from './useJobWorkspaceNavigation'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'

const LazyInvoiceCreateFlow = lazy(async () => ({
  default: (await import('../invoices/InvoiceCreateFlow')).InvoiceCreateFlow,
}))

const LazyPaymentCreateFlow = lazy(async () => ({
  default: (await import('../payments/PaymentCreateFlow')).PaymentCreateFlow,
}))

type JobWorkspaceAction = 'invoice' | 'payment' | null

interface JobWorkspaceProps {
  job: JobListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  activeTab: JobWorkspaceTab
  onTabChange: (tab: JobWorkspaceTab) => void
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenClientWorkspace: (clientId: string) => void
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onPendingStateChange?: (hasPendingState: boolean) => void
}

function getWorkspaceTabLabel(tab: JobWorkspaceTab) {
  switch (tab) {
    case 'summary': return 'Resumen'
    case 'operations': return 'Operativa'
    case 'billing': return 'Facturacion'
    case 'activity': return 'Actividad / Notas'
  }
}

function getRecommendedNextStep(
  job: JobListItem,
  invoice: InvoiceListItem | null,
  paymentSummary: ReturnType<typeof buildInvoicePaymentSummary> | null,
) {
  if (job.status !== 'completed') return 'Completar el servicio y revisar la ejecucion'
  if (!invoice) return 'Emitir factura desde el servicio'
  if (!paymentSummary || paymentSummary.outstandingAmount <= 0.009) return 'Servicio cerrado y cobrado'
  if (paymentSummary.paidAmount <= 0.009) return 'Registrar cobro o hacer seguimiento'
  if (paymentSummary.financialStatus === 'partially_paid') return 'Revisar saldo pendiente de cobro'
  return 'Servicio cerrado y cobrado'
}

function getJobPrimaryAction(
  job: JobListItem,
  invoice: InvoiceListItem | null,
  outstanding: number,
): JobWorkspaceAction | 'open-invoice' | 'edit' {
  if (job.status === 'completed' && !invoice) return 'invoice'
  if (invoice && outstanding > 0.009) return 'payment'
  if (invoice) return 'open-invoice'
  return 'edit'
}

function getOperationalSignal(
  job: JobListItem,
  invoice: InvoiceListItem | null,
  outstanding: number,
) {
  if (job.status === 'completed' && !invoice) {
    return {
      label: 'Listo para facturar',
      detail: 'El servicio ya termino y aun no genero factura.',
      tone: 'warning' as const,
    }
  }

  if (invoice && outstanding > 0) {
    return {
      label: 'Pendiente de cobro',
      detail: 'Existe factura emitida con saldo abierto.',
      tone: 'warning' as const,
    }
  }

  if (invoice && outstanding <= 0) {
    return {
      label: 'Cobro completado',
      detail: 'El ciclo de servicio y cobro esta cerrado.',
      tone: 'success' as const,
    }
  }

  if (job.status === 'cancelled') {
    return {
      label: 'Servicio cancelado',
      detail: 'Quedo fuera del circuito operativo activo.',
      tone: 'warning' as const,
    }
  }

  return {
    label: 'En seguimiento operativo',
    detail: 'Todavia forma parte de la agenda activa de ejecucion.',
    tone: 'info' as const,
  }
}

function TimelineCard({ item }: { item: RelationshipTimelineItem }) {
  return (
    <article className={`cc-client-workspace__timeline-item cc-client-workspace__timeline-item--${item.tone}`}>
      <span>{formatDateEs(item.date)}</span>
      <strong>{item.title}</strong>
      <p>{item.detail}</p>
    </article>
  )
}

export function JobWorkspace({
  job,
  clients,
  properties,
  quotes,
  invoices,
  payments,
  activeTab,
  onTabChange,
  onClose,
  onRefresh,
  onOpenClientWorkspace,
  onOpenPropertyWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onPendingStateChange,
}: JobWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<JobWorkspaceAction>(null)
  const [hasPendingDetailState, setHasPendingDetailState] = useState(false)
  const [hasActionDirty, setHasActionDirty] = useState(false)
  const [showMajorEdit, setShowMajorEdit] = useState(false)
  const [hasMajorEditDirty, setHasMajorEditDirty] = useState(false)
  const [showCloseActionConfirm, setShowCloseActionConfirm] = useState(false)

  const client = useMemo(
    () => clients.find((entry) => entry.id === job.client_id) ?? null,
    [clients, job.client_id],
  )
  const property = useMemo(
    () => properties.find((entry) => entry.id === job.property_id) ?? null,
    [job.property_id, properties],
  )
  const quote = useMemo(
    () => (job.quote_id ? quotes.find((entry) => entry.id === job.quote_id) ?? null : null),
    [job.quote_id, quotes],
  )
  const invoice = useMemo(
    () =>
      invoices.find((entry) => entry.job_id === job.id)
      ?? (job.invoice_id ? invoices.find((entry) => entry.id === job.invoice_id) ?? null : null),
    [invoices, job.id, job.invoice_id],
  )
  const relatedPayments = useMemo(
    () => (invoice ? payments.filter((payment) => payment.invoice_id === invoice.id) : []),
    [invoice, payments],
  )
  const totalCollected = useMemo(
    () => relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [relatedPayments],
  )
  const paymentSummary = useMemo(
    () => (invoice ? buildInvoicePaymentSummary(invoice, relatedPayments) : null),
    [invoice, relatedPayments],
  )
  const outstanding = paymentSummary?.outstandingAmount ?? 0
  const nextStep = getRecommendedNextStep(job, invoice, paymentSummary)
  const operationalSignal = getOperationalSignal(job, invoice, outstanding)
  const primaryAction = getJobPrimaryAction(job, invoice, outstanding)
  const timelineItems = useMemo(
    () => buildJobTimelineItems({ job, quote, invoice, payments: relatedPayments }),
    [invoice, job, quote, relatedPayments],
  )
  const invoiceCreatePrefill = useMemo(
    () => buildInvoiceCreatePrefillFromJob(job),
    [job],
  )
  const heroActions: ActionGroupItem[] = []

  if (primaryAction === 'invoice') {
    heroActions.push({
      key: 'create-invoice',
      label: 'Crear factura',
      tone: 'primary',
      onClick: () => openAction('invoice'),
    })
  } else if (primaryAction === 'payment') {
    heroActions.push({
      key: 'register-payment',
      label: 'Registrar cobro',
      tone: 'primary',
      onClick: () => openAction('payment'),
    })
  } else if (primaryAction === 'open-invoice' && invoice) {
    heroActions.push({
      key: 'open-invoice',
      label: 'Abrir factura',
      tone: 'primary',
      onClick: () => onOpenInvoiceDetail(invoice.id),
    })
  } else {
    heroActions.push({
      key: 'edit-job',
      label: 'Editar servicio',
      tone: 'primary',
      onClick: () => setShowMajorEdit(true),
    })
  }

  if (!invoice && primaryAction !== 'invoice') {
    heroActions.push({
      key: 'create-invoice-secondary',
      label: 'Crear factura',
      onClick: () => openAction('invoice'),
    })
  }

  if (invoice) {
    if (primaryAction !== 'open-invoice') {
      heroActions.push({
        key: 'open-invoice-secondary',
        label: 'Abrir factura',
        onClick: () => onOpenInvoiceDetail(invoice.id),
      })
    }

    if (primaryAction !== 'payment') {
      heroActions.push({
        key: 'register-payment-secondary',
        label: 'Registrar cobro',
        onClick: () => openAction('payment'),
      })
    }
  }

  if (quote) {
    heroActions.push({
      key: 'open-quote',
      label: 'Ver presupuesto origen',
      onClick: () => onOpenQuoteDetail(quote.id),
    })
  }

  heroActions.push(
    {
      key: 'open-client',
      label: 'Abrir cliente',
      onClick: () => onOpenClientWorkspace(job.client_id),
    },
    {
      key: 'open-property',
      label: 'Abrir propiedad',
      onClick: () => onOpenPropertyWorkspace(job.property_id),
    },
  )
  const dedupedHeroActions = heroActions.filter(
    (action, index, actions) => actions.findIndex((candidate) => candidate.label === action.label) === index,
  )

  useEffect(() => {
    onPendingStateChange?.(hasActionDirty || hasPendingDetailState || hasMajorEditDirty)
  }, [hasActionDirty, hasMajorEditDirty, hasPendingDetailState, onPendingStateChange])

  async function handleActionCreated() {
    await onRefresh()
    setActiveAction(null)
    setHasActionDirty(false)
  }

  async function handleFlowCompleted() {
    setActiveAction(null)
    setHasActionDirty(false)
  }

  function openAction(action: JobWorkspaceAction) {
    setActiveAction(action)
    setHasActionDirty(false)
    onTabChange('billing')
  }

  function requestCloseAction() {
    if (!hasActionDirty) {
      setActiveAction(null)
      return
    }

    setShowCloseActionConfirm(true)
  }

  return (
    <section className="cc-client-workspace">
      <div className="cc-client-workspace__topline">
        <button type="button" className="secondary-button" onClick={onClose}>
          Volver a servicios
        </button>
        <span className="cc-client-workspace__eyebrow">Workspace de servicio</span>
      </div>

      <header className="cc-client-workspace__hero">
        <div className="cc-client-workspace__identity">
          <div className="cc-client-workspace__identity-copy">
            <span className="cc-client-workspace__kicker">Operacion viva</span>
            <h1>{job.billing_concept?.trim() || getServiceTypeLabel(job.service_type)}</h1>
            <p>{formatJobLabel(job)} · {formatDateEs(job.scheduled_date)}</p>
          </div>

          <div className="cc-client-workspace__status">
            <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
            <span className="cc-client-workspace__status-meta">{job.display_code ?? job.id}</span>
          </div>
        </div>

        <div className="cc-client-workspace__meta">
          <article className="cc-client-workspace__meta-card">
            <span>Cliente</span>
            <strong>{client ? formatClientLabel(client) : formatClientLabel(job)}</strong>
            <small>{client?.phone ?? client?.email ?? 'Sin contacto principal'}</small>
          </article>
        </div>
      </header>

      <section className="cc-client-workspace__snapshot">
        <article className="cc-client-workspace__snapshot-card">
          <span>Situacion actual</span>
          <strong>{operationalSignal.label}</strong>
          <small>{operationalSignal.detail}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Factura</span>
          <strong>{invoice ? formatInvoiceLabel(invoice) : 'Pendiente de emitir'}</strong>
          <small>{invoice && paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Todavia no emitida'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Saldo</span>
          <strong>{invoice ? formatCurrency(outstanding) : 'Sin factura'}</strong>
          <small>{invoice ? `${formatCurrency(totalCollected)} cobrados` : 'No aplica todavia'}</small>
        </article>
      </section>

      <details className="cc-client-workspace__context-toggle">
        <summary className="cc-client-workspace__context-toggle-summary">
          <span>Contexto ampliado</span>
          <strong>Ver propiedad y facturacion extendida</strong>
        </summary>

        <div className="cc-client-workspace__context-toggle-grid cc-client-workspace__context-toggle-grid--meta">
          <article className="cc-client-workspace__meta-card">
            <span>Propiedad</span>
            <strong>
              {property
                ? formatPropertyLabel(property)
                : formatPropertyLabel({
                    id: job.property_id,
                    display_code: job.property_display_code,
                    name: job.property_name,
                  })}
            </strong>
            <small>{property?.address ?? 'Sin direccion ampliada'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Facturacion</span>
            <strong>{job.billing_concept?.trim() || 'Sin concepto definido'}</strong>
            <small>{quote ? `Origen ${formatQuoteLabel(quote)}` : 'Servicio directo sin presupuesto origen'}</small>
          </article>
        </div>
      </details>

      <section className="cc-client-workspace__next-step">
        <div>
          <span>Siguiente paso recomendado</span>
          <strong>{nextStep}</strong>
          <small>{operationalSignal.detail}</small>
        </div>
        <ActionGroup actions={dedupedHeroActions} moreLabel="Mas acciones" />
      </section>

      <nav className="cc-client-workspace__tabs" aria-label="Secciones del servicio">
        {jobWorkspaceTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === activeTab ? 'cc-client-workspace__tab is-active' : 'cc-client-workspace__tab'}
            onClick={() => onTabChange(tab)}
          >
            {getWorkspaceTabLabel(tab)}
          </button>
        ))}
      </nav>

      {activeAction ? (
        <ActionFlowOverlay
          isOpen={Boolean(activeAction)}
          title={activeAction === 'invoice' ? 'Nueva factura' : 'Registrar cobro'}
          description={`La accion se guardara vinculada a ${formatJobLabel(job)}. Al cerrar volveras a este servicio.`}
          onClose={requestCloseAction}
        >
          {activeAction === 'invoice' ? (
            <Suspense fallback={<DeferredContentFallback title="Cargando flujo de factura" description="Preparando la accion financiera del servicio." />}>
              <LazyInvoiceCreateFlow
                clients={client ? [client] : clients}
                properties={property ? [property] : properties}
                jobs={[job]}
                quotes={quote ? [quote] : []}
                onRefreshData={onRefresh}
                onCompleted={handleActionCreated}
                prefill={invoiceCreatePrefill}
                onCancel={requestCloseAction}
                onDirtyChange={setHasActionDirty}
              />
            </Suspense>
          ) : null}

          {activeAction === 'payment' ? (
            <Suspense fallback={<DeferredContentFallback title="Cargando flujo de cobro" description="Preparando la accion de cobro del servicio." />}>
              <LazyPaymentCreateFlow
                invoices={invoice ? [invoice] : []}
                clients={client ? [client] : clients}
                properties={property ? [property] : properties}
                jobs={[job]}
                quotes={quote ? [quote] : []}
                onRefreshData={onRefresh}
                onCompleted={handleFlowCompleted}
                onCancel={requestCloseAction}
                onDirtyChange={setHasActionDirty}
              />
            </Suspense>
          ) : null}
        </ActionFlowOverlay>
      ) : null}

      <MajorEditFlowOverlay
        isOpen={showMajorEdit}
        title="Editar servicio"
        description={`La edicion mayor se trabaja fuera de la card y al cerrar vuelves a ${formatJobLabel(job)}.`}
        onClose={() => {
          if (hasMajorEditDirty) {
            setShowCloseActionConfirm(true)
            return
          }

          setShowMajorEdit(false)
        }}
      >
        <JobDetailCard
          job={job}
          clients={clients}
          properties={properties}
          quotes={quotes}
          onJobUpdated={onRefresh}
          onCreateInvoiceFromJob={() => openAction('invoice')}
          onUnsavedChange={setHasMajorEditDirty}
          hideHeaderActions
          majorEditMode
          onMajorEditClose={() => {
            setShowMajorEdit(false)
            setHasMajorEditDirty(false)
          }}
        />
      </MajorEditFlowOverlay>

      {activeTab === 'summary' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__summary-grid">
          <article className="data-section">
            <div className="section-header">
              <h2>Donde estoy</h2>
              <p>Lectura minima del servicio dentro del circuito operativo.</p>
            </div>

            <div className="cc-client-workspace__ledger-grid">
              <div className="detail-row">
                <span className="detail-label">Cliente</span>
                <strong>{client ? formatClientLabel(client) : 'Sin cliente'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Propiedad</span>
                <strong>{property ? formatPropertyLabel(property) : 'Sin propiedad'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Presupuesto origen</span>
                <strong>{quote ? formatQuoteLabel(quote) : 'Servicio directo'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Factura</span>
                <strong>{invoice ? formatInvoiceLabel(invoice) : 'Todavia no emitida'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cobrado</span>
                <strong>{invoice ? formatCurrency(totalCollected) : 'Sin factura'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pendiente</span>
                <strong>{invoice ? formatCurrency(outstanding) : 'Sin factura'}</strong>
              </div>
            </div>
          </article>

            <article className="data-section">
              <div className="section-header">
                <h2>Que toca ahora</h2>
                <p>Una sola lectura para ejecutar, facturar o cobrar.</p>
              </div>

              <div className="cc-client-workspace__focus-list">
                <article className="cc-client-workspace__focus-card">
                  <span>Siguiente paso</span>
                  <strong>{nextStep}</strong>
                  <small>{operationalSignal.detail}</small>
                </article>
                <article className="cc-client-workspace__focus-card">
                  <span>Relacion importante</span>
                  <strong>{invoice ? formatInvoiceLabel(invoice) : quote ? formatQuoteLabel(quote) : 'Servicio directo'}</strong>
                  <small>{invoice ? 'La factura manda sobre el cobro.' : quote ? 'El presupuesto explica el origen del servicio.' : 'No depende de un presupuesto previo.'}</small>
                </article>
              </div>
            </article>
          </section>
      ) : null}

      {activeTab === 'operations' ? (
        <section className="cc-client-workspace__tab-panel">
          <JobDetailCard
            job={job}
            clients={clients}
            properties={properties}
            quotes={quotes}
            onJobUpdated={onRefresh}
            onCreateInvoiceFromJob={() => openAction('invoice')}
            onUnsavedChange={setHasPendingDetailState}
            onRequestMajorEdit={() => setShowMajorEdit(true)}
          />
        </section>
      ) : null}

      {activeTab === 'billing' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          <article className="data-section cc-client-workspace__entity-card">
            <div className="section-header">
              <div>
                <h2>Factura</h2>
                <p>{invoice ? formatInvoiceLabel(invoice) : 'Sin factura asociada'}</p>
              </div>
              <span className="lead-badge">
                {invoice && paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Pendiente'}
              </span>
            </div>

            <div className="cc-client-workspace__detail-stack">
              <div className="detail-row">
                <span className="detail-label">Total</span>
                <strong>{invoice ? formatCurrency(invoice.total) : 'Sin factura'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cobrado</span>
                <strong>{invoice ? formatCurrency(totalCollected) : 'Sin factura'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pendiente</span>
                <strong>{invoice ? formatCurrency(outstanding) : 'Sin factura'}</strong>
              </div>
            </div>
          </article>

          <article className="data-section cc-client-workspace__entity-card">
            <div className="section-header">
              <div>
                <h2>Cobros</h2>
                <p>Seguimiento real del dinero asociado al servicio.</p>
              </div>
            </div>

            <div className="cc-client-workspace__timeline">
              {relatedPayments.map((payment) => (
                <TimelineCard
                  key={payment.id}
                  item={{
                    id: payment.id,
                    date: payment.payment_date,
                    title: 'Cobro registrado',
                    detail: `${payment.display_code ?? payment.id} · ${formatCurrency(payment.amount)}`,
                    tone: 'success',
                    entityType: 'payment',
                    entityId: payment.id,
                  }}
                />
              ))}
              {relatedPayments.length === 0 ? <p>No hay cobros registrados para este servicio.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'activity' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__activity-grid">
          <article className="data-section">
            <div className="section-header">
              <h2>Timeline relacional</h2>
              <p>Eventos reales del servicio, su presupuesto, su factura y sus cobros.</p>
            </div>

            <div className="cc-client-workspace__timeline">
              {timelineItems.map((item) => (
                <TimelineCard key={item.id} item={item} />
              ))}
              {timelineItems.length === 0 ? <p>No hay suficiente historial relacional para este servicio.</p> : null}
            </div>
          </article>

          <article className="data-section">
            <div className="section-header">
              <h2>Notas y contexto</h2>
              <p>Lectura operativa consolidada de servicio, propiedad y facturacion.</p>
            </div>

            <div className="cc-client-workspace__notes">
              <article className="cc-client-workspace__note-card">
                <span>Servicio</span>
                <strong>{formatJobLabel(job)}</strong>
                <p>{job.notes?.trim() || 'Sin notas operativas registradas.'}</p>
              </article>
              {property?.notes?.trim() ? (
                <article className="cc-client-workspace__note-card">
                  <span>Propiedad</span>
                  <strong>{formatPropertyLabel(property)}</strong>
                  <p>{property.notes.trim()}</p>
                </article>
              ) : null}
              {quote?.notes?.trim() ? (
                <article className="cc-client-workspace__note-card">
                  <span>Presupuesto</span>
                  <strong>{formatQuoteLabel(quote)}</strong>
                  <p>{quote.notes.trim()}</p>
                </article>
              ) : null}
              {invoice?.notes?.trim() ? (
                <article className="cc-client-workspace__note-card">
                  <span>Factura</span>
                  <strong>{formatInvoiceLabel(invoice)}</strong>
                  <p>{invoice.notes.trim()}</p>
                </article>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}
      <ConfirmDialog
        isOpen={showCloseActionConfirm}
        title="Descartar accion en curso"
        description="Has empezado a completar esta accion contextual. Si la cierras ahora, perderas los cambios no guardados."
        confirmLabel="Descartar cambios"
        tone="warning"
        onCancel={() => setShowCloseActionConfirm(false)}
        onConfirm={() => {
          setShowCloseActionConfirm(false)
          setActiveAction(null)
          setHasActionDirty(false)
          setShowMajorEdit(false)
          setHasMajorEditDirty(false)
        }}
      />
    </section>
  )
}
