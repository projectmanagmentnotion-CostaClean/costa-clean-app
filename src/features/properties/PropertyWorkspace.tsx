import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs, getPaymentMethodLabel, getPropertyTypeLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { InvoiceCreatePrefill } from '../invoices/invoiceCreatePrefill'
import { InvoiceCreateFlow } from '../invoices/InvoiceCreateFlow'
import { buildInvoicePaymentSummary, getInvoiceFinancialStatusLabel } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import { JobCreateFlow } from '../jobs/JobCreateFlow'
import type { JobCreatePrefill } from '../jobs/jobCreatePrefill'
import type { JobListItem } from '../jobs/types'
import { PaymentCreateFlow } from '../payments/PaymentCreateFlow'
import type { PaymentListItem } from '../payments/types'
import { WorkspaceRelationBrowser } from '../../components/WorkspaceRelationBrowser'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { PropertyDetailCard } from './PropertyDetailCard'
import type { PropertyWorkspaceTab } from './usePropertyWorkspaceNavigation'
import { propertyWorkspaceTabs } from './usePropertyWorkspaceNavigation'
import { QuoteCreateFlow } from '../quotes/QuoteCreateFlow'
import type { QuoteListItem } from '../quotes/types'
import { formatClientLabel, formatInvoiceLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from './types'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'

type PropertyWorkspaceAction = 'job' | 'quote' | 'invoice' | 'payment' | null

interface PropertyWorkspaceProps {
  property: PropertyListItem
  clients: ClientListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  activeTab: PropertyWorkspaceTab
  onTabChange: (tab: PropertyWorkspaceTab) => void
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenClientWorkspace: (clientId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onPendingStateChange?: (hasPendingState: boolean) => void
}

interface PropertyActivityItem {
  id: string
  date: string
  title: string
  detail: string
  tone: 'info' | 'success' | 'warning'
}

function createPrefillId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function getWorkspaceTabLabel(tab: PropertyWorkspaceTab): string {
  switch (tab) {
    case 'summary': return 'Resumen'
    case 'jobs': return 'Servicios'
    case 'quotes': return 'Presupuestos'
    case 'invoices': return 'Facturas'
    case 'payments': return 'Cobros'
    case 'activity': return 'Actividad / Notas'
  }
}

function getActionTitle(action: Exclude<PropertyWorkspaceAction, null>) {
  switch (action) {
    case 'job': return 'Nuevo servicio'
    case 'quote': return 'Nuevo presupuesto'
    case 'invoice': return 'Nueva factura'
    case 'payment': return 'Registrar cobro'
  }
}

function getPropertyNextStep(
  pendingBalance: number,
  nextJob: JobListItem | null,
  relatedJobsCount: number,
  relatedQuotesCount: number,
) {
  if (pendingBalance > 0.009) {
    return {
      title: 'Registrar o perseguir el cobro pendiente',
      detail: 'La prioridad operativa esta en cerrar el saldo abierto de esta propiedad.',
      action: 'payment' as const,
    }
  }

  if (!nextJob && relatedJobsCount === 0 && relatedQuotesCount > 0) {
    return {
      title: 'Convertir el trabajo pendiente en servicio',
      detail: 'Ya existe actividad comercial y falta moverla a ejecucion.',
      action: 'job' as const,
    }
  }

  if (!nextJob) {
    return {
      title: 'Programar un nuevo servicio',
      detail: 'No hay agenda futura para esta propiedad y conviene marcar la siguiente visita.',
      action: 'job' as const,
    }
  }

  return {
    title: 'Preparar el proximo servicio',
    detail: `La propiedad ya tiene agenda y el siguiente hito esta previsto para ${formatDateEs(nextJob.scheduled_date)}.`,
    action: 'job' as const,
  }
}

export function PropertyWorkspace({
  property,
  clients,
  jobs,
  quotes,
  invoices,
  payments,
  activeTab,
  onTabChange,
  onClose,
  onRefresh,
  onOpenClientWorkspace,
  onOpenJobWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onPendingStateChange,
}: PropertyWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<PropertyWorkspaceAction>(null)
  const [editRequestToken, setEditRequestToken] = useState(0)
  const [hasPendingDetailState, setHasPendingDetailState] = useState(false)
  const [hasActionDirty, setHasActionDirty] = useState(false)
  const [showCloseActionConfirm, setShowCloseActionConfirm] = useState(false)

  const owner = useMemo(
    () => clients.find((client) => client.id === property.client_id) ?? null,
    [clients, property.client_id],
  )
  const relatedJobs = useMemo(
    () => jobs.filter((job) => job.property_id === property.id),
    [jobs, property.id],
  )
  const relatedQuotes = useMemo(
    () => quotes.filter((quote) => quote.property_id === property.id),
    [property.id, quotes],
  )
  const relatedInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.property_id === property.id),
    [invoices, property.id],
  )
  const relatedInvoiceIds = useMemo(
    () => new Set(relatedInvoices.map((invoice) => invoice.id)),
    [relatedInvoices],
  )
  const relatedPayments = useMemo(
    () => payments.filter((payment) => relatedInvoiceIds.has(payment.invoice_id)),
    [payments, relatedInvoiceIds],
  )
  const quoteById = useMemo(
    () => new Map(relatedQuotes.map((quote) => [quote.id, quote])),
    [relatedQuotes],
  )
  const invoiceById = useMemo(
    () => new Map(relatedInvoices.map((invoice) => [invoice.id, invoice])),
    [relatedInvoices],
  )

  const sortedJobsAsc = useMemo(
    () => [...relatedJobs].sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date)),
    [relatedJobs],
  )
  const sortedInvoicesDesc = useMemo(
    () => [...relatedInvoices].sort((left, right) => right.issue_date.localeCompare(left.issue_date)),
    [relatedInvoices],
  )

  const nextJob = sortedJobsAsc.find((job) => job.status !== 'cancelled' && job.scheduled_date >= new Date().toISOString().slice(0, 10)) ?? null
  const latestInvoice = sortedInvoicesDesc[0] ?? null
  const totalInvoiced = relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)
  const totalCollected = relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  const pendingBalance = totalInvoiced - totalCollected
  const nextStep = getPropertyNextStep(pendingBalance, nextJob, relatedJobs.length, relatedQuotes.length)

  const activityItems = useMemo<PropertyActivityItem[]>(() => {
    const items: PropertyActivityItem[] = []

    for (const quote of relatedQuotes) {
      if (!quote.created_at) continue
      items.push({
        id: `quote-${quote.id}`,
        date: quote.created_at,
        title: `Presupuesto ${formatQuoteLabel(quote)}`,
        detail: `${getStatusLabel(quote.status)} - ${formatCurrency(quote.total)}`,
        tone: quote.status === 'accepted' ? 'success' : 'info',
      })
    }

    for (const job of relatedJobs) {
      items.push({
        id: `job-${job.id}`,
        date: job.scheduled_date,
        title: `Servicio ${formatJobLabel(job)}`,
        detail: `${getStatusLabel(job.status)} - ${getServiceTypeLabel(job.service_type)}`,
        tone: job.status === 'completed' ? 'success' : 'warning',
      })
    }

    for (const invoice of relatedInvoices) {
      const paymentSummary = buildInvoicePaymentSummary(invoice, relatedPayments.filter((payment) => payment.invoice_id === invoice.id))
      items.push({
        id: `invoice-${invoice.id}`,
        date: invoice.issue_date,
        title: `Factura ${formatInvoiceLabel(invoice)}`,
        detail: `${getInvoiceFinancialStatusLabel(paymentSummary.financialStatus)} - ${formatCurrency(invoice.total)}`,
        tone: paymentSummary.financialStatus === 'paid' ? 'success' : 'warning',
      })
    }

    for (const payment of relatedPayments) {
      items.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        title: `Cobro ${formatInvoiceLabel(invoiceById.get(payment.invoice_id) ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number })}`,
        detail: `${formatCurrency(payment.amount)} - ${getPaymentMethodLabel(payment.payment_method)}`,
        tone: 'success',
      })
    }

    return items.sort((left, right) => right.date.localeCompare(left.date))
  }, [invoiceById, relatedInvoices, relatedJobs, relatedPayments, relatedQuotes])

  const invoicePrefill = useMemo<InvoiceCreatePrefill>(() => ({
    request_id: createPrefillId(`property-invoice-${property.id}`),
    origin_kind: 'manual',
    job_id: '',
    quote_id: '',
    client_id: property.client_id,
    property_id: property.id,
    notes: '',
    lines: [],
    title: property.display_code ?? property.id,
  }), [property.client_id, property.display_code, property.id])

  const jobPrefill = useMemo<JobCreatePrefill>(() => ({
    request_id: createPrefillId(`property-job-${property.id}`),
    origin_kind: 'property',
    client_id: property.client_id,
    property_id: property.id,
    quote_id: '',
    notes: property.notes?.trim() ?? '',
    billing_concept: '',
    service_type: 'standard_cleaning',
  }), [property.client_id, property.id, property.notes])
  const heroActions: ActionGroupItem[] = [
    {
      key: nextStep.action === 'payment' ? 'primary-payment' : 'primary-job',
      label: nextStep.action === 'payment' ? 'Registrar cobro' : 'Nuevo servicio',
      tone: 'primary',
      onClick: () => openAction(nextStep.action),
    },
    {
      key: 'new-quote',
      label: 'Nuevo presupuesto',
      onClick: () => openAction('quote'),
    },
    {
      key: 'new-invoice',
      label: 'Nueva factura',
      onClick: () => openAction('invoice'),
    },
    {
      key: 'register-payment',
      label: 'Registrar cobro',
      onClick: () => openAction('payment'),
    },
    {
      key: 'edit-property',
      label: 'Editar propiedad',
      onClick: () => {
        onTabChange('summary')
        setEditRequestToken((current) => current + 1)
      },
    },
  ]
  const dedupedHeroActions = heroActions.filter(
    (action, index, actions) => actions.findIndex((candidate) => candidate.label === action.label) === index,
  )

  useEffect(() => {
    onPendingStateChange?.(hasActionDirty || hasPendingDetailState)
  }, [hasActionDirty, hasPendingDetailState, onPendingStateChange])

  async function handleActionCreated() {
    await onRefresh()
    setActiveAction(null)
    setHasActionDirty(false)
  }

  async function handleFlowCompleted() {
    setActiveAction(null)
    setHasActionDirty(false)
  }

  function openAction(action: Exclude<PropertyWorkspaceAction, null>) {
    setActiveAction(action)
    setHasActionDirty(false)
    if (action === 'payment') {
      onTabChange('payments')
      return
    }

    if (action === 'invoice') {
      onTabChange('invoices')
      return
    }

    if (action === 'quote') {
      onTabChange('quotes')
      return
    }

    onTabChange('jobs')
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
          Volver a cartera
        </button>
        <span className="cc-client-workspace__eyebrow">Workspace de propiedad</span>
      </div>

      <header className="cc-client-workspace__hero">
        <div className="cc-client-workspace__identity">
          <div className="cc-client-workspace__identity-copy">
            <span className="cc-client-workspace__kicker">Contexto operativo</span>
            <h1>{property.name}</h1>
            <p>{formatPropertyLabel(property)} - {property.address}</p>
          </div>

          <div className="cc-client-workspace__status">
            <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
            <span className="cc-client-workspace__status-meta">{owner ? formatClientLabel(owner) : 'Sin cliente'}</span>
          </div>
        </div>

        <div className="cc-client-workspace__meta">
          <article className="cc-client-workspace__meta-card">
            <span>Cliente asociado</span>
            <strong>{owner ? formatClientLabel(owner) : 'Sin cliente'}</strong>
            <small>{owner?.phone ?? owner?.email ?? 'Sin contacto principal'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Ubicacion operativa</span>
            <strong>{property.address || 'Sin direccion'}</strong>
            <small>{[property.city, property.postal_code].filter(Boolean).join(' · ') || 'Sin ciudad ni codigo postal'}</small>
          </article>
        </div>
      </header>

      <section className="cc-client-workspace__snapshot">
        <article className="cc-client-workspace__snapshot-card">
          <span>Situacion actual</span>
          <strong>{pendingBalance > 0.009 ? 'Cobro pendiente' : nextJob ? 'Con agenda activa' : 'Sin agenda futura'}</strong>
          <small>{pendingBalance > 0.009 ? 'La prioridad es cerrar el saldo abierto.' : nextJob ? `Siguiente servicio ${formatDateEs(nextJob.scheduled_date)}` : 'Conviene programar el siguiente servicio.'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(pendingBalance)}</strong>
          <small>{pendingBalance > 0 ? 'Facturas con cobro pendiente' : 'Sin saldo pendiente relevante'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Proximo servicio</span>
          <strong>{nextJob ? formatJobLabel(nextJob) : 'No programado'}</strong>
          <small>{nextJob ? formatDateEs(nextJob.scheduled_date) : 'Sin agenda futura'}</small>
        </article>
      </section>

      <section className="cc-client-workspace__next-step">
        <div>
          <span>Siguiente paso recomendado</span>
          <strong>{nextStep.title}</strong>
          <small>{nextStep.detail}</small>
        </div>
        <ActionGroup actions={dedupedHeroActions} moreLabel="Mas acciones" />
      </section>

      <nav className="cc-client-workspace__tabs" aria-label="Secciones de la propiedad">
        {propertyWorkspaceTabs.map((tab) => (
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
          title={getActionTitle(activeAction)}
          description={`La accion se guardara vinculada a ${formatPropertyLabel(property)} y ${owner ? formatClientLabel(owner) : 'sin cliente'}. Al cerrar volveras a esta propiedad.`}
          onClose={requestCloseAction}
        >
          {activeAction === 'job' ? (
            <JobCreateFlow
              key={`property-job-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              quotes={relatedQuotes}
              onRefreshData={onRefresh}
              onCompleted={handleFlowCompleted}
              prefill={jobPrefill}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'quote' ? (
            <QuoteCreateFlow
              key={`property-quote-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              contextClientId={property.client_id}
              contextPropertyId={property.id}
              onRefreshData={onRefresh}
              onCompleted={handleActionCreated}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'invoice' ? (
            <InvoiceCreateFlow
              key={`property-invoice-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onRefreshData={onRefresh}
              onCompleted={handleActionCreated}
              prefill={invoicePrefill}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'payment' ? (
            <PaymentCreateFlow
              key={`property-payment-${property.id}`}
              invoices={relatedInvoices}
              clients={owner ? [owner] : clients}
              properties={[property]}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onRefreshData={onRefresh}
              onCompleted={handleFlowCompleted}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}
        </ActionFlowOverlay>
      ) : null}

      {activeTab === 'summary' ? (
        <div className="cc-client-workspace__tab-panel">
          <section className="cc-client-workspace__summary-grid">
            <article className="data-section">
              <div className="section-header">
                <h2>Situacion actual</h2>
                <p>Lo minimo para leer dinero, agenda y carga operativa.</p>
              </div>

              <div className="cc-client-workspace__ledger-grid">
                <div className="detail-row">
                  <span className="detail-label">Servicios</span>
                  <strong>{relatedJobs.length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Presupuestos</span>
                  <strong>{relatedQuotes.length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Facturas</span>
                  <strong>{relatedInvoices.length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cobros</span>
                  <strong>{relatedPayments.length}</strong>
                </div>
              </div>
            </article>

            <article className="data-section">
              <div className="section-header">
                <h2>Que mirar despues</h2>
                <p>Solo relaciones que pueden cambiar el siguiente paso.</p>
              </div>

              <div className="cc-client-workspace__focus-list">
                <article className="cc-client-workspace__focus-card">
                  <span>Siguiente paso</span>
                  <strong>{nextStep.title}</strong>
                  <small>{nextStep.detail}</small>
                </article>
                <article className="cc-client-workspace__focus-card">
                  <span>Documento que importa</span>
                  <strong>
                    {latestInvoice
                      ? formatInvoiceLabel(latestInvoice)
                      : relatedQuotes[0]
                        ? formatQuoteLabel(relatedQuotes[0])
                        : 'Sin documento dominante'}
                  </strong>
                  <small>
                    {latestInvoice
                      ? 'La ultima factura marca la lectura financiera.'
                      : relatedQuotes[0]
                        ? 'El presupuesto pendiente explica la siguiente conversion.'
                        : 'Todavia no hay una relacion documental prioritaria.'}
                  </small>
                </article>
              </div>
            </article>
          </section>

          <PropertyDetailCard
            property={property}
            clients={clients}
            jobs={jobs}
            quotes={quotes}
            invoices={invoices}
            onPropertyUpdated={onRefresh}
            hideHeaderActions
            editRequestToken={editRequestToken}
            onEditingStateChange={setHasPendingDetailState}
          />
        </div>
      ) : null}

      {activeTab === 'jobs' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Servicios de la propiedad"
            emptyTitle="Sin servicios"
            emptyDescription="Esta propiedad todavía no tiene servicios vinculados."
            items={relatedJobs.map((job) => ({
              id: job.id,
              title: formatJobLabel(job),
              subtitle: getServiceTypeLabel(job.service_type),
              statusLabel: getStatusLabel(job.status),
              context: job.notes?.trim() || 'Sin notas operativas registradas para este servicio.',
              rowMeta: [
                formatDateEs(job.scheduled_date),
                job.invoice_id ? 'Con factura' : 'Sin factura',
              ],
              detailSummary: 'Servicio activo dentro de esta propiedad.',
              detailFields: [
                { label: 'Fecha', value: formatDateEs(job.scheduled_date) },
                { label: 'Cliente', value: owner ? formatClientLabel(owner) : 'Sin cliente' },
                { label: 'Tipo', value: getServiceTypeLabel(job.service_type) },
                { label: 'Presupuesto origen', value: job.quote_id ? formatQuoteLabel(quoteById.get(job.quote_id) ?? { id: job.quote_id, display_code: job.quote_display_code, client_name: owner?.full_name ?? null, property_name: property.name }) : 'Sin presupuesto' },
                { label: 'Factura', value: job.invoice_id ? formatInvoiceLabel(invoiceById.get(job.invoice_id) ?? { id: job.invoice_id }) : 'Pendiente de facturar' },
              ],
              actions: [
                {
                  key: 'open-job',
                  label: 'Ver servicio',
                  tone: 'primary',
                  onClick: () => onOpenJobWorkspace(job.id),
                },
                ...(owner
                  ? [{
                      key: 'open-client',
                      label: 'Ver cliente',
                      onClick: () => onOpenClientWorkspace(owner.id),
                    }]
                  : []),
                ...(job.quote_id
                  ? [{
                      key: 'open-quote',
                      label: 'Ver presupuesto',
                      onClick: () => onOpenQuoteDetail(job.quote_id!),
                    }]
                  : []),
                ...(job.invoice_id
                  ? [{
                      key: 'open-invoice',
                      label: 'Ver factura',
                      onClick: () => onOpenInvoiceDetail(job.invoice_id!),
                    }]
                  : []),
              ],
            }))}
          />
        </section>
      ) : null}

      {activeTab === 'quotes' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Presupuestos de la propiedad"
            emptyTitle="Sin presupuestos"
            emptyDescription="Esta propiedad todavía no tiene presupuestos asociados."
            items={relatedQuotes.map((quote) => ({
              id: quote.id,
              title: formatQuoteLabel(quote),
              subtitle: owner ? formatClientLabel(owner) : 'Sin cliente',
              statusLabel: getStatusLabel(quote.status),
              context: quote.notes?.trim() || quote.internal_notes?.trim() || 'Sin notas visibles para este presupuesto.',
              rowMeta: [
                quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha',
                formatCurrency(quote.total),
                quote.invoice_id ? 'Facturado' : 'Sin facturar',
              ],
              detailSummary: 'Presupuesto de esta propiedad y su conversion operativa.',
              detailFields: [
                { label: 'Total', value: formatCurrency(quote.total) },
                { label: 'Creado', value: quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha' },
                { label: 'Cliente', value: owner ? formatClientLabel(owner) : 'Sin cliente' },
                { label: 'Servicio generado', value: quote.job_id ? formatJobLabel(relatedJobs.find((job) => job.id === quote.job_id) ?? { id: quote.job_id, client_name: owner?.full_name ?? null, property_name: property.name }) : 'Todavía no generado' },
                { label: 'Factura generada', value: quote.invoice_id ? formatInvoiceLabel(invoiceById.get(quote.invoice_id) ?? { id: quote.invoice_id }) : 'Todavía no generada' },
              ],
              actions: [
                {
                  key: 'open-quote',
                  label: 'Ver presupuesto',
                  tone: 'primary',
                  onClick: () => onOpenQuoteDetail(quote.id),
                },
                ...(owner
                  ? [{
                      key: 'open-client',
                      label: 'Ver cliente',
                      onClick: () => onOpenClientWorkspace(owner.id),
                    }]
                  : []),
                ...(quote.job_id
                  ? [{
                      key: 'open-job',
                      label: 'Ver servicio',
                      onClick: () => onOpenJobWorkspace(quote.job_id!),
                    }]
                  : []),
                ...(quote.invoice_id
                  ? [{
                      key: 'open-invoice',
                      label: 'Ver factura',
                      onClick: () => onOpenInvoiceDetail(quote.invoice_id!),
                    }]
                  : []),
              ],
            }))}
          />
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Facturas de la propiedad"
            emptyTitle="Sin facturas"
            emptyDescription="Esta propiedad todavía no tiene facturas emitidas."
            items={relatedInvoices.map((invoice) => {
              const invoicePayments = relatedPayments.filter((payment) => payment.invoice_id === invoice.id)
              const paymentSummary = buildInvoicePaymentSummary(invoice, invoicePayments)

              return {
                id: invoice.id,
                title: formatInvoiceLabel(invoice),
                subtitle: owner ? formatClientLabel(owner) : 'Sin cliente',
                statusLabel: getInvoiceFinancialStatusLabel(paymentSummary.financialStatus),
                context: invoice.notes?.trim() || 'Sin notas visibles en esta factura.',
                rowMeta: [
                  formatDateEs(invoice.issue_date),
                  formatCurrency(invoice.total),
                  `Pendiente ${formatCurrency(paymentSummary.outstandingAmount)}`,
                ],
                detailSummary: 'Factura vinculada a la propiedad con su saldo actual.',
                detailFields: [
                  { label: 'Emitida', value: formatDateEs(invoice.issue_date) },
                  { label: 'Total', value: formatCurrency(invoice.total) },
                  { label: 'Cobrado', value: formatCurrency(paymentSummary.paidAmount) },
                  { label: 'Pendiente', value: formatCurrency(paymentSummary.outstandingAmount) },
                  { label: 'Cliente', value: owner ? formatClientLabel(owner) : 'Sin cliente' },
                ],
                actions: [
                  {
                    key: 'open-invoice',
                    label: 'Ver factura',
                    tone: 'primary',
                    onClick: () => onOpenInvoiceDetail(invoice.id),
                  },
                  ...(owner
                    ? [{
                        key: 'open-client',
                        label: 'Ver cliente',
                        onClick: () => onOpenClientWorkspace(owner.id),
                      }]
                    : []),
                ],
              }
            })}
          />
        </section>
      ) : null}

      {activeTab === 'payments' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Cobros de la propiedad"
            emptyTitle="Sin cobros"
            emptyDescription="Todavía no se han registrado cobros relacionados con esta propiedad."
            items={relatedPayments.map((payment) => {
              const paymentInvoice = invoiceById.get(payment.invoice_id) ?? null

              return {
                id: payment.id,
                title: formatInvoiceLabel(paymentInvoice ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number }),
                subtitle: formatDateEs(payment.payment_date),
                statusLabel: getPaymentMethodLabel(payment.payment_method),
                context: payment.notes?.trim() || 'Sin notas adicionales para este cobro.',
                rowMeta: [
                  formatCurrency(payment.amount),
                  getPaymentMethodLabel(payment.payment_method),
                  owner ? formatClientLabel(owner) : 'Sin cliente',
                ],
                detailSummary: 'Cobro registrado para esta propiedad.',
                detailFields: [
                  { label: 'Importe', value: formatCurrency(payment.amount) },
                  { label: 'Método', value: getPaymentMethodLabel(payment.payment_method) },
                  { label: 'Fecha', value: formatDateEs(payment.payment_date) },
                  { label: 'Factura', value: formatInvoiceLabel(paymentInvoice ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number }) },
                  { label: 'Cliente', value: owner ? formatClientLabel(owner) : 'Sin cliente' },
                ],
                actions: [
                  {
                    key: 'open-invoice',
                    label: 'Ver factura',
                    tone: 'primary',
                    onClick: () => onOpenInvoiceDetail(payment.invoice_id),
                  },
                  ...(owner
                    ? [{
                        key: 'open-client',
                        label: 'Ver cliente',
                        onClick: () => onOpenClientWorkspace(owner.id),
                      }]
                    : []),
                ],
              }
            })}
          />
        </section>
      ) : null}

      {activeTab === 'activity' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__activity-grid">
          <article className="data-section">
            <div className="section-header">
              <h2>Timeline relacional</h2>
              <p>Secuencia real de presupuestos, servicios, facturas y cobros del inmueble.</p>
            </div>

            <div className="cc-client-workspace__timeline">
              {activityItems.map((item) => (
                <article key={item.id} className={`cc-client-workspace__timeline-item cc-client-workspace__timeline-item--${item.tone}`}>
                  <span>{formatDateEs(item.date)}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
              {activityItems.length === 0 ? <p>Sin actividad historica suficiente.</p> : null}
            </div>
          </article>

          <article className="data-section">
            <div className="section-header">
              <h2>Contexto operativo</h2>
              <p>Notas, accesos y trazabilidad de documentos vinculados.</p>
            </div>

            <div className="cc-client-workspace__notes">
              <article className="cc-client-workspace__note-card">
                <span>Nota de propiedad</span>
                <strong>{formatPropertyLabel(property)}</strong>
                <p>{property.notes?.trim() || 'Sin notas operativas registradas.'}</p>
              </article>
              {relatedQuotes.filter((quote) => quote.notes?.trim()).map((quote) => (
                <article key={`quote-note-${quote.id}`} className="cc-client-workspace__note-card">
                  <span>Nota de presupuesto</span>
                  <strong>{formatQuoteLabel(quote)}</strong>
                  <p>{quote.notes?.trim()}</p>
                </article>
              ))}
              {relatedInvoices.filter((invoice) => invoice.notes?.trim()).map((invoice) => (
                <article key={`invoice-note-${invoice.id}`} className="cc-client-workspace__note-card">
                  <span>Nota de factura</span>
                  <strong>{formatInvoiceLabel(invoice)}</strong>
                  <p>{invoice.notes?.trim()}</p>
                </article>
              ))}
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
        }}
      />
    </section>
  )
}
