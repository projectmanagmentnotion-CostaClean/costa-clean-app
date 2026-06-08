import { useEffect, useMemo, useState } from 'react'
import {
  formatCurrency,
  formatDateEs,
  getDisplayStatusLabel,
  getPaymentMethodLabel,
  getPropertyTypeLabel,
  getServiceTypeLabel,
} from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import {
  formatClientLabel,
  formatInvoiceLabel,
  formatJobLabel,
  formatPropertyLabel,
  formatQuoteLabel,
  formatRecurringPlanLabel,
} from '../../app/relationshipLabels'
import { ClientDetailCard } from './ClientDetailCard'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { WorkspaceRelationBrowser } from '../../components/WorkspaceRelationBrowser'
import { ActionGroup, type ActionGroupItem } from '../../components/ActionGroup'
import type { ClientWorkspaceTab } from './useClientWorkspaceNavigation'
import { clientWorkspaceTabs } from './useClientWorkspaceNavigation'
import type { ClientListItem } from './types'
import { buildInvoicePaymentSummary, getInvoiceFinancialStatusLabel } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import { InvoiceCreateForm } from '../invoices/InvoiceCreateForm'
import type { JobListItem } from '../jobs/types'
import { JobCreateForm } from '../jobs/JobCreateForm'
import type { PaymentListItem } from '../payments/types'
import { PaymentCreateForm } from '../payments/PaymentCreateForm'
import type { PropertyListItem } from '../properties/types'
import { PropertyCreateForm } from '../properties/PropertyCreateForm'
import type { QuoteListItem } from '../quotes/types'
import { QuoteCreateForm } from '../quotes/QuoteCreateForm'
import { RecurringInvoicePlanForm } from '../recurringInvoices/RecurringInvoicePlanForm'
import { generateInvoiceFromRecurringPlan } from '../recurringInvoices/recurringInvoiceApi'
import { getRecurringFrequencyLabel, isRecurringPlanDue } from '../recurringInvoices/recurringInvoiceSchedule'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'

type ClientWorkspaceAction = 'property' | 'job' | 'quote' | 'invoice' | 'payment' | 'recurring' | null

interface ClientWorkspaceProps {
  client: ClientListItem
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
  activeTab: ClientWorkspaceTab
  onTabChange: (tab: ClientWorkspaceTab) => void
  onClose: () => void
  onRefresh: () => Promise<void>
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onPendingStateChange?: (hasPendingState: boolean) => void
}

interface ClientActivityItem {
  id: string
  date: string
  title: string
  detail: string
  tone: 'info' | 'success' | 'warning'
}

interface ClientNoteItem {
  id: string
  label: string
  body: string
  meta: string
}

function createPrefillId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}`
}

function buildOriginLabel(client: ClientListItem): string {
  if (!client.source_lead_id) {
    return 'Alta directa'
  }

  if (client.source_lead_display_code && client.source_lead_name) {
    return `${client.source_lead_display_code} - ${client.source_lead_name}`
  }

  return client.source_lead_display_code ?? client.source_lead_id
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NaN
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  return new Date(normalizedValue).getTime()
}

function compareByDateDesc(left: string | null | undefined, right: string | null | undefined) {
  return toTimestamp(right) - toTimestamp(left)
}

function buildActionTab(action: Exclude<ClientWorkspaceAction, null>): ClientWorkspaceTab {
  switch (action) {
    case 'property': return 'properties'
    case 'job': return 'jobs'
    case 'quote': return 'quotes'
    case 'invoice': return 'invoices'
    case 'payment': return 'payments'
    case 'recurring': return 'invoices'
  }
}

function getWorkspaceTabLabel(tab: ClientWorkspaceTab): string {
  switch (tab) {
    case 'summary': return 'Resumen'
    case 'properties': return 'Propiedades'
    case 'jobs': return 'Servicios'
    case 'quotes': return 'Presupuestos'
    case 'invoices': return 'Facturas'
    case 'payments': return 'Cobros'
    case 'activity': return 'Actividad / Notas'
  }
}

function getActionTitle(action: Exclude<ClientWorkspaceAction, null>) {
  switch (action) {
    case 'property': return 'Nueva propiedad'
    case 'job': return 'Nuevo servicio'
    case 'quote': return 'Nuevo presupuesto'
    case 'invoice': return 'Nueva factura'
    case 'payment': return 'Registrar cobro'
    case 'recurring': return 'Automatizacion recurrente'
  }
}

function getClientNextStep(
  client: ClientListItem,
  relatedPropertiesCount: number,
  dueRecurringPlansCount: number,
  pendingBalance: number,
  nextJob: JobListItem | null,
) {
  if (!client.tax_id || !client.billing_address) {
    return {
      title: 'Completar la ficha fiscal',
      detail: 'Conviene cerrar NIF/CIF y direccion fiscal antes de seguir ampliando la facturacion.',
      action: 'edit' as const,
    }
  }

  if (relatedPropertiesCount === 0) {
    return {
      title: 'Crear la primera propiedad',
      detail: 'Sin propiedad vinculada cuesta encadenar presupuestos, servicios y facturas con contexto.',
      action: 'property' as const,
    }
  }

  if (pendingBalance > 0.009) {
    return {
      title: 'Hacer seguimiento del cobro pendiente',
      detail: 'Hay saldo abierto y el siguiente paso natural es registrar o empujar el cobro.',
      action: 'payment' as const,
    }
  }

  if (dueRecurringPlansCount > 0) {
    return {
      title: 'Revisar la facturacion automatica vencida',
      detail: 'Hay planes recurrentes activos listos para emitir o revisar.',
      action: 'recurring' as const,
    }
  }

  if (nextJob) {
    return {
      title: 'Preparar el proximo servicio',
      detail: `Hay un servicio programado para ${formatDateEs(nextJob.scheduled_date)} y el cliente ya esta operativo.`,
      action: 'job' as const,
    }
  }

  return {
    title: 'Programar un nuevo servicio',
    detail: 'La ficha esta lista y el siguiente paso natural es crear operativa nueva.',
    action: 'job' as const,
  }
}

export function ClientWorkspace({
  client,
  properties,
  jobs,
  quotes,
  invoices,
  payments,
  recurringInvoicePlans,
  activeTab,
  onTabChange,
  onClose,
  onRefresh,
  onOpenPropertyWorkspace,
  onOpenJobWorkspace,
  onOpenQuoteDetail,
  onOpenInvoiceDetail,
  onPendingStateChange,
}: ClientWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<ClientWorkspaceAction>(null)
  const [editRequestToken, setEditRequestToken] = useState(0)
  const [archiveRequestToken, setArchiveRequestToken] = useState(0)
  const [isClientEditing, setIsClientEditing] = useState(false)
  const [editingRecurringPlanId, setEditingRecurringPlanId] = useState<string | null>(null)
  const [recurringFeedback, setRecurringFeedback] = useState<string | null>(null)
  const [pendingRecurringPlanId, setPendingRecurringPlanId] = useState<string | null>(null)
  const [hasActionDirty, setHasActionDirty] = useState(false)
  const [showCloseActionConfirm, setShowCloseActionConfirm] = useState(false)

  const relatedProperties = useMemo(
    () => properties.filter((property) => property.client_id === client.id),
    [client.id, properties],
  )
  const relatedJobs = useMemo(
    () => jobs.filter((job) => job.client_id === client.id),
    [client.id, jobs],
  )
  const relatedQuotes = useMemo(
    () => quotes.filter((quote) => quote.client_id === client.id),
    [client.id, quotes],
  )
  const relatedInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.client_id === client.id),
    [client.id, invoices],
  )
  const invoiceIds = useMemo(
    () => new Set(relatedInvoices.map((invoice) => invoice.id)),
    [relatedInvoices],
  )
  const relatedPayments = useMemo(
    () => payments.filter((payment) => invoiceIds.has(payment.invoice_id)),
    [invoiceIds, payments],
  )
  const relatedRecurringPlans = useMemo(
    () => recurringInvoicePlans.filter((plan) => plan.client_id === client.id),
    [client.id, recurringInvoicePlans],
  )
  const propertyById = useMemo(
    () => new Map(relatedProperties.map((property) => [property.id, property])),
    [relatedProperties],
  )
  const quoteById = useMemo(
    () => new Map(relatedQuotes.map((quote) => [quote.id, quote])),
    [relatedQuotes],
  )
  const invoiceById = useMemo(
    () => new Map(relatedInvoices.map((invoice) => [invoice.id, invoice])),
    [relatedInvoices],
  )

  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, PaymentListItem[]>()

    for (const payment of relatedPayments) {
      const currentItems = map.get(payment.invoice_id) ?? []
      currentItems.push(payment)
      map.set(payment.invoice_id, currentItems)
    }

    return map
  }, [relatedPayments])

  const totalCollected = useMemo(
    () => relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [relatedPayments],
  )
  const pendingBalance = relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0) - totalCollected

  const sortedInvoices = useMemo(
    () => [...relatedInvoices].sort((left, right) => compareByDateDesc(left.issue_date, right.issue_date)),
    [relatedInvoices],
  )
  const sortedJobsAsc = useMemo(
    () => [...relatedJobs].sort((left, right) => toTimestamp(left.scheduled_date) - toTimestamp(right.scheduled_date)),
    [relatedJobs],
  )
  const sortedJobsDesc = useMemo(
    () => [...relatedJobs].sort((left, right) => compareByDateDesc(left.scheduled_date, right.scheduled_date)),
    [relatedJobs],
  )
  const latestInvoice = sortedInvoices[0] ?? null
  const dueRecurringPlans = useMemo(
    () => relatedRecurringPlans.filter((plan) => plan.status === 'active' && isRecurringPlanDue(plan.next_issue_date)),
    [relatedRecurringPlans],
  )
  const latestIssuedRecurringPlan = useMemo(
    () => [...relatedRecurringPlans]
      .filter((plan) => Boolean(plan.last_issued_at))
      .sort((left, right) => compareByDateDesc(left.last_issued_at, right.last_issued_at))[0] ?? null,
    [relatedRecurringPlans],
  )

  const todayTimestamp = toTimestamp(new Date().toISOString())
  const nextJob = sortedJobsAsc.find((job) => toTimestamp(job.scheduled_date) >= todayTimestamp && job.status !== 'cancelled') ?? null
  const latestJob = sortedJobsDesc.find((job) => toTimestamp(job.scheduled_date) <= todayTimestamp || job.status === 'completed')
    ?? sortedJobsDesc[0]
    ?? null
  const nextStep = getClientNextStep(
    client,
    relatedProperties.length,
    dueRecurringPlans.length,
    pendingBalance,
    nextJob,
  )

  const quotesByPropertyId = useMemo(() => {
    const map = new Map<string, QuoteListItem[]>()

    for (const quote of relatedQuotes) {
      if (!quote.property_id) continue
      const currentItems = map.get(quote.property_id) ?? []
      currentItems.push(quote)
      map.set(quote.property_id, currentItems)
    }

    return map
  }, [relatedQuotes])

  const jobsByPropertyId = useMemo(() => {
    const map = new Map<string, JobListItem[]>()

    for (const job of relatedJobs) {
      const currentItems = map.get(job.property_id) ?? []
      currentItems.push(job)
      map.set(job.property_id, currentItems)
    }

    return map
  }, [relatedJobs])

  const invoicesByPropertyId = useMemo(() => {
    const map = new Map<string, InvoiceListItem[]>()

    for (const invoice of relatedInvoices) {
      if (!invoice.property_id) continue
      const currentItems = map.get(invoice.property_id) ?? []
      currentItems.push(invoice)
      map.set(invoice.property_id, currentItems)
    }

    return map
  }, [relatedInvoices])

  const activityItems = useMemo<ClientActivityItem[]>(() => {
    const items: ClientActivityItem[] = []

    if (client.created_at) {
      items.push({
        id: `client-${client.id}`,
        date: client.created_at,
        title: 'Cliente dado de alta',
        detail: buildOriginLabel(client),
        tone: 'info',
      })
    }

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
        detail: `${formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name })} - ${getStatusLabel(job.status)}`,
        tone: job.status === 'completed' ? 'success' : 'warning',
      })
    }

    for (const invoice of relatedInvoices) {
      const paymentSummary = buildInvoicePaymentSummary(invoice, paymentsByInvoiceId.get(invoice.id) ?? [])
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

    return items.sort((left, right) => compareByDateDesc(left.date, right.date))
  }, [client, invoiceById, paymentsByInvoiceId, relatedInvoices, relatedJobs, relatedPayments, relatedQuotes])

  const noteItems = useMemo<ClientNoteItem[]>(() => {
    const items: ClientNoteItem[] = []

    for (const property of relatedProperties) {
      if (!property.notes?.trim()) continue
      items.push({
        id: `property-note-${property.id}`,
        label: 'Nota de propiedad',
        body: property.notes.trim(),
        meta: formatPropertyLabel(property),
      })
    }

    for (const job of relatedJobs) {
      if (!job.notes?.trim()) continue
      items.push({
        id: `job-note-${job.id}`,
        label: 'Nota de servicio',
        body: job.notes.trim(),
        meta: `${formatJobLabel(job)} - ${formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name })}`,
      })
    }

    for (const quote of relatedQuotes) {
      if (quote.notes?.trim()) {
        items.push({
          id: `quote-note-${quote.id}`,
          label: 'Nota visible de presupuesto',
          body: quote.notes.trim(),
          meta: formatQuoteLabel(quote),
        })
      }

      if (quote.internal_notes?.trim()) {
        items.push({
          id: `quote-internal-${quote.id}`,
          label: 'Nota interna de presupuesto',
          body: quote.internal_notes.trim(),
          meta: formatQuoteLabel(quote),
        })
      }
    }

    for (const invoice of relatedInvoices) {
      if (!invoice.notes?.trim()) continue
      items.push({
        id: `invoice-note-${invoice.id}`,
        label: 'Nota de factura',
        body: invoice.notes.trim(),
        meta: formatInvoiceLabel(invoice),
      })
    }

    for (const payment of relatedPayments) {
      if (!payment.notes?.trim()) continue
      items.push({
        id: `payment-note-${payment.id}`,
        label: 'Nota de cobro',
        body: payment.notes.trim(),
        meta: formatInvoiceLabel(invoiceById.get(payment.invoice_id) ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number }),
      })
    }

    return items
  }, [invoiceById, relatedInvoices, relatedJobs, relatedPayments, relatedProperties, relatedQuotes])

  useEffect(() => {
    onPendingStateChange?.(hasActionDirty || isClientEditing || Boolean(pendingRecurringPlanId))
  }, [hasActionDirty, isClientEditing, onPendingStateChange, pendingRecurringPlanId])

  function openAction(action: Exclude<ClientWorkspaceAction, null>) {
    setActiveAction(action)
    setHasActionDirty(false)
    onTabChange(buildActionTab(action))
  }

  async function handleActionCreated() {
    await onRefresh()
    setActiveAction(null)
    setEditingRecurringPlanId(null)
    setHasActionDirty(false)
  }

  function requestCloseAction() {
    if (!hasActionDirty) {
      setActiveAction(null)
      setEditingRecurringPlanId(null)
      return
    }

    setShowCloseActionConfirm(true)
  }

  async function handleRecurringPlanIssued(planId: string) {
    setPendingRecurringPlanId(planId)
    setRecurringFeedback(null)

    try {
      await generateInvoiceFromRecurringPlan(planId)
      await onRefresh()
      setRecurringFeedback('Factura recurrente emitida y plan actualizado.')
    } finally {
      setPendingRecurringPlanId(null)
    }
  }

  const jobCreatePrefill = useMemo(
    () => ({
      request_id: createPrefillId(`client-job-${client.id}`),
      origin_kind: 'client' as const,
      client_id: client.id,
      property_id: '',
      quote_id: '',
      notes: '',
      billing_concept: '',
      service_type: 'standard_cleaning',
    }),
    [client.id],
  )
  const heroActions: ActionGroupItem[] = []

  const openRecurringAction = () => {
    setEditingRecurringPlanId(null)
    openAction('recurring')
  }

  if (nextStep.action === 'property') {
    heroActions.push({
      key: 'new-property',
      label: 'Nueva propiedad',
      tone: 'primary',
      onClick: () => openAction('property'),
    })
  } else if (nextStep.action === 'payment') {
    heroActions.push({
      key: 'register-payment',
      label: 'Registrar cobro',
      tone: 'primary',
      onClick: () => openAction('payment'),
    })
  } else if (nextStep.action === 'recurring') {
    heroActions.push({
      key: 'open-recurring',
      label: 'Automatizar factura',
      tone: 'primary',
      onClick: openRecurringAction,
    })
  } else if (nextStep.action === 'edit') {
    heroActions.push({
      key: 'edit-client',
      label: 'Editar cliente',
      tone: 'primary',
      onClick: () => {
        onTabChange('summary')
        setActiveAction(null)
        setEditRequestToken((current) => current + 1)
      },
    })
  } else {
    heroActions.push({
      key: 'new-job',
      label: 'Nuevo servicio',
      tone: 'primary',
      onClick: () => openAction('job'),
    })
  }

  heroActions.push(
    {
      key: 'secondary-property',
      label: 'Nueva propiedad',
      onClick: () => openAction('property'),
    },
    {
      key: 'secondary-job',
      label: 'Nuevo servicio',
      onClick: () => openAction('job'),
    },
    {
      key: 'secondary-quote',
      label: 'Nuevo presupuesto',
      onClick: () => openAction('quote'),
    },
    {
      key: 'secondary-invoice',
      label: 'Nueva factura',
      onClick: () => openAction('invoice'),
    },
    {
      key: 'secondary-recurring',
      label: 'Automatizar factura',
      onClick: openRecurringAction,
    },
    {
      key: 'secondary-payment',
      label: 'Registrar cobro',
      onClick: () => openAction('payment'),
    },
    {
      key: 'secondary-edit',
      label: 'Editar cliente',
      onClick: () => {
        onTabChange('summary')
        setActiveAction(null)
        setEditRequestToken((current) => current + 1)
      },
    },
  )

  if (client.status !== 'inactive') {
    heroActions.push({
      key: 'archive-client',
      label: 'Archivar cliente',
      onClick: () => {
        onTabChange('summary')
        setActiveAction(null)
        setArchiveRequestToken((current) => current + 1)
      },
    })
  }
  const dedupedHeroActions = heroActions.filter(
    (action, index, actions) => actions.findIndex((candidate) => candidate.label === action.label) === index,
  )

  return (
    <section className="cc-client-workspace">
      <div className="cc-client-workspace__topline">
        <button type="button" className="secondary-button" onClick={onClose}>
          Volver a cartera
        </button>
        <span className="cc-client-workspace__eyebrow">Workspace de cliente</span>
      </div>

      <header className="cc-client-workspace__hero">
        <div className="cc-client-workspace__identity">
          <div className="cc-client-workspace__identity-copy">
            <span className="cc-client-workspace__kicker">Centro operativo</span>
            <h1>{client.full_name}</h1>
            <p>{formatClientLabel(client)} - {buildOriginLabel(client)}</p>
          </div>

          <div className="cc-client-workspace__status">
            <span className="lead-badge">{getDisplayStatusLabel(client.status)}</span>
            <span className="cc-client-workspace__status-meta">{client.tax_id ?? 'Sin NIF/CIF'}</span>
          </div>
        </div>

        <div className="cc-client-workspace__meta">
          <article className="cc-client-workspace__meta-card">
            <span>Contacto</span>
            <strong>{client.phone ?? 'Sin telefono'}</strong>
            <small>{client.email ?? 'Sin email'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Ficha fiscal</span>
            <strong>{client.tax_id ?? 'Pendiente'}</strong>
            <small>{client.billing_address ?? buildOriginLabel(client)}</small>
          </article>
        </div>
      </header>
      <section className="cc-client-workspace__snapshot">
        <article className="cc-client-workspace__snapshot-card">
          <span>Situacion actual</span>
          <strong>
            {pendingBalance > 0.009
              ? 'Cobro pendiente'
              : nextJob
                ? 'Con agenda activa'
                : relatedProperties.length > 0
                  ? 'Sin siguiente visita'
                  : 'Sin propiedades'}
          </strong>
          <small>{nextStep.detail}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(pendingBalance)}</strong>
          <small>{pendingBalance > 0 ? 'Facturas con saldo abierto' : 'Sin saldo pendiente relevante'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Proximo servicio</span>
          <strong>{nextJob ? formatJobLabel(nextJob) : 'No programado'}</strong>
          <small>{nextJob ? formatDateEs(nextJob.scheduled_date) : 'Sin agenda futura'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Automatizacion</span>
          <strong>{dueRecurringPlans.length > 0 ? `${dueRecurringPlans.length} por emitir` : `${relatedRecurringPlans.length} plan(es)`}</strong>
          <small>{latestIssuedRecurringPlan ? `Ultima emision ${formatDateEs(latestIssuedRecurringPlan.last_issued_at ?? latestIssuedRecurringPlan.next_issue_date)}` : 'Sin emisiones recurrentes previas'}</small>
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

      <nav className="cc-client-workspace__tabs" aria-label="Secciones del cliente">
        {clientWorkspaceTabs.map((tab) => (
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
          description={`La accion se guardara ya vinculada al cliente ${formatClientLabel(client)}. Al cerrar volveras a este workspace.`}
          onClose={requestCloseAction}
        >

          {activeAction === 'property' ? (
            <PropertyCreateForm
              key={`property-${client.id}`}
              clients={[client]}
              contextClientId={client.id}
              onCreated={handleActionCreated}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'job' ? (
            <JobCreateForm
              key={`job-${client.id}`}
              clients={[client]}
              properties={relatedProperties}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
              prefill={jobCreatePrefill}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
              onOpenCreatedJob={(jobId) => onOpenJobWorkspace(jobId)}
            />
          ) : null}

          {activeAction === 'quote' ? (
            <QuoteCreateForm
              key={`quote-${client.id}`}
              clients={[client]}
              properties={relatedProperties}
              contextClientId={client.id}
              onCreated={handleActionCreated}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'invoice' ? (
            <InvoiceCreateForm
              key={`invoice-${client.id}`}
              clients={[client]}
              properties={relatedProperties}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'payment' ? (
            <PaymentCreateForm
              key={`payment-${client.id}`}
              invoices={relatedInvoices}
              clients={[client]}
              properties={relatedProperties}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
              onCancel={requestCloseAction}
              onDirtyChange={setHasActionDirty}
            />
          ) : null}

          {activeAction === 'recurring' ? (
            <RecurringInvoicePlanForm
              key={`recurring-${editingRecurringPlanId ?? client.id}`}
              clientId={client.id}
              clients={[client]}
              properties={relatedProperties}
              quotes={relatedQuotes}
              initialPlan={relatedRecurringPlans.find((plan) => plan.id === editingRecurringPlanId) ?? null}
              onSaved={handleActionCreated}
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
                <p>Lo minimo para decidir ficha, agenda, factura o cobro.</p>
              </div>
              <div className="cc-client-workspace__ledger-grid">
                <div className="detail-row">
                  <span className="detail-label">Pendiente</span>
                  <strong>{formatCurrency(pendingBalance)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cobrado</span>
                  <strong>{formatCurrency(totalCollected)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Facturas pagadas</span>
                  <strong>{relatedInvoices.filter((invoice) => invoice.payment_status === 'paid').length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Facturas pendientes</span>
                  <strong>{relatedInvoices.filter((invoice) => invoice.payment_status !== 'paid' && invoice.status !== 'cancelled').length}</strong>
                </div>
              </div>
            </article>
            <article className="data-section">
              <div className="section-header">
                <h2>Que importa ahora</h2>
                <p>Solo relaciones que cambian el siguiente paso.</p>
              </div>
              <div className="cc-client-workspace__focus-list">
                <article className="cc-client-workspace__focus-card">
                  <span>Siguiente paso</span>
                  <strong>{nextStep.title}</strong>
                  <small>{nextStep.detail}</small>
                </article>
                <article className="cc-client-workspace__focus-card">
                  <span>Documento dominante</span>
                  <strong>
                    {latestInvoice
                      ? formatInvoiceLabel(latestInvoice)
                      : latestJob
                        ? formatJobLabel(latestJob)
                        : 'Sin documento prioritario'}
                  </strong>
                  <small>
                    {latestInvoice
                      ? 'La ultima factura manda sobre el cobro y el seguimiento.'
                      : latestJob
                        ? 'El ultimo servicio marca el punto operativo actual.'
                        : 'Aun no hay historico suficiente para una prioridad documental.'}
                  </small>
                </article>
                {relatedProperties.slice(0, 3).map((property) => (
                  <article key={property.id} className="cc-client-workspace__focus-card">
                    <span>Propiedad viva</span>
                    <strong>{formatPropertyLabel(property)}</strong>
                    <small>
                      {jobsByPropertyId.get(property.id)?.length ?? 0} servicio(s) · {quotesByPropertyId.get(property.id)?.length ?? 0} presupuesto(s) · {invoicesByPropertyId.get(property.id)?.length ?? 0} factura(s)
                    </small>
                  </article>
                ))}
                {relatedProperties.length === 0 ? <p>Este cliente aun no tiene propiedades vinculadas.</p> : null}
              </div>
            </article>
            <article className="data-section">
              <div className="section-header">
                <h2>Automatizacion recurrente</h2>
                <p>Planes activos y emisiones que siguen vivas hoy.</p>
              </div>
              <div className="cc-client-workspace__focus-list">
                {relatedRecurringPlans.slice(0, 3).map((plan) => (
                  <article key={plan.id} className="cc-client-workspace__focus-card">
                    <span>Plan recurrente</span>
                    <strong>{formatRecurringPlanLabel(plan)}</strong>
                    <small>
                      {getRecurringFrequencyLabel(plan.frequency)} · {plan.status} · siguiente emision {formatDateEs(plan.next_issue_date)}
                    </small>
                  </article>
                ))}
                {relatedRecurringPlans.length === 0 ? <p>Este cliente aun no tiene automatizaciones recurrentes.</p> : null}
              </div>
            </article>
          </section>
          <ClientDetailCard
            client={client}
            properties={properties}
            jobs={jobs}
            quotes={quotes}
            invoices={invoices}
            payments={payments}
            onClientUpdated={onRefresh}
            hideHeaderActions
            editRequestToken={editRequestToken}
            archiveRequestToken={archiveRequestToken}
            onEditingStateChange={setIsClientEditing}
          />
        </div>
      ) : null}

      {activeTab === 'properties' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Propiedades del cliente"
            emptyTitle="Sin propiedades"
            emptyDescription="Crea la primera propiedad para empezar a conectar servicios y documentos desde el workspace."
            items={relatedProperties.map((property) => {
              const propertyJobs = jobsByPropertyId.get(property.id) ?? []
              const propertyQuotes = quotesByPropertyId.get(property.id) ?? []
              const propertyInvoices = invoicesByPropertyId.get(property.id) ?? []

              return {
                id: property.id,
                title: formatPropertyLabel(property),
                subtitle: property.address,
                statusLabel: getPropertyTypeLabel(property.property_type),
                context: property.notes?.trim() || 'Sin notas operativas registradas para esta propiedad.',
                rowMeta: [
                  property.city ?? 'Sin ciudad',
                  `${propertyJobs.length} servicio(s)`,
                  `${propertyInvoices.length} factura(s)`,
                ],
                detailSummary: 'Vista operativa del inmueble dentro del cliente seleccionado.',
                detailFields: [
                  { label: 'Ciudad', value: property.city ?? 'Sin ciudad' },
                  { label: 'Código postal', value: property.postal_code ?? 'Sin código postal' },
                  { label: 'Servicios', value: `${propertyJobs.length}` },
                  { label: 'Presupuestos', value: `${propertyQuotes.length}` },
                  { label: 'Facturas', value: `${propertyInvoices.length}` },
                  { label: 'Dirección', value: property.address || 'Sin dirección' },
                ],
                detailBody: propertyJobs.length > 0 ? (
                  <div className="cc-client-workspace__notes">
                    {propertyJobs.slice(0, 3).map((job) => (
                      <article key={job.id} className="cc-client-workspace__note-card">
                        <span>Servicio vinculado</span>
                        <strong>{formatJobLabel(job)}</strong>
                        <p>{getServiceTypeLabel(job.service_type)} · {formatDateEs(job.scheduled_date)} · {getStatusLabel(job.status)}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="cc-client-workspace__note-card">
                    <span>Servicios vinculados</span>
                    <strong>Sin actividad operativa</strong>
                    <p>Esta propiedad todavía no tiene servicios relacionados.</p>
                  </div>
                ),
                actions: [
                  {
                    key: 'open-property',
                    label: 'Ver propiedad',
                    tone: 'primary',
                    onClick: () => onOpenPropertyWorkspace(property.id),
                  },
                ],
              }
            })}
          />
        </section>
      ) : null}

      {activeTab === 'jobs' ? (
        <section className="cc-client-workspace__tab-panel">
          <WorkspaceRelationBrowser
            ariaLabel="Servicios del cliente"
            emptyTitle="Sin servicios"
            emptyDescription="Este cliente todavía no tiene servicios registrados."
            items={relatedJobs.map((job) => ({
              id: job.id,
              title: formatJobLabel(job),
              subtitle: formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name }),
              statusLabel: getStatusLabel(job.status),
              context: job.notes?.trim() || 'Sin notas operativas registradas para este servicio.',
              rowMeta: [
                formatDateEs(job.scheduled_date),
                getServiceTypeLabel(job.service_type),
                job.invoice_id ? 'Con factura' : 'Sin factura',
              ],
              detailSummary: 'Servicio conectado al cliente con trazabilidad hacia propiedad, presupuesto y factura.',
              detailFields: [
                { label: 'Fecha', value: formatDateEs(job.scheduled_date) },
                { label: 'Tipo', value: getServiceTypeLabel(job.service_type) },
                { label: 'Propiedad', value: formatPropertyLabel({ id: job.property_id, display_code: job.property_display_code, name: job.property_name }) },
                { label: 'Presupuesto origen', value: job.quote_id ? formatQuoteLabel({ id: job.quote_id, display_code: job.quote_display_code, client_name: job.client_name, property_name: job.property_name }) : 'Sin presupuesto' },
                { label: 'Factura', value: job.invoice_id ? formatInvoiceLabel(invoiceById.get(job.invoice_id) ?? { id: job.invoice_id }) : 'Pendiente de facturar' },
              ],
              actions: [
                {
                  key: 'open-job',
                  label: 'Ver servicio',
                  tone: 'primary',
                  onClick: () => onOpenJobWorkspace(job.id),
                },
                {
                  key: 'open-property',
                  label: 'Ver propiedad',
                  onClick: () => onOpenPropertyWorkspace(job.property_id),
                },
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
            ariaLabel="Presupuestos del cliente"
            emptyTitle="Sin presupuestos"
            emptyDescription="Este cliente todavía no tiene presupuestos asociados."
            items={relatedQuotes.map((quote) => ({
              id: quote.id,
              title: formatQuoteLabel(quote),
              subtitle: quote.property_id
                ? formatPropertyLabel({ id: quote.property_id, display_code: quote.property_display_code, name: propertyById.get(quote.property_id)?.name ?? null })
                : 'Sin propiedad vinculada',
              statusLabel: getStatusLabel(quote.status),
              context: quote.notes?.trim() || quote.internal_notes?.trim() || 'Sin notas visibles para este presupuesto.',
              rowMeta: [
                quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha',
                formatCurrency(quote.total),
                quote.invoice_id ? 'Facturado' : 'Sin facturar',
              ],
              detailSummary: 'Presupuesto conectado al cliente y listo para seguir su conversión a servicio o factura.',
              detailFields: [
                { label: 'Total', value: formatCurrency(quote.total) },
                { label: 'Creado', value: quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha' },
                { label: 'Propiedad', value: quote.property_id ? formatPropertyLabel({ id: quote.property_id, display_code: quote.property_display_code, name: propertyById.get(quote.property_id)?.name ?? null }) : 'Sin propiedad vinculada' },
                { label: 'Servicio generado', value: quote.job_id ? formatJobLabel(relatedJobs.find((job) => job.id === quote.job_id) ?? { id: quote.job_id, display_code: undefined, client_name: quote.client_name, property_name: quote.property_id ? propertyById.get(quote.property_id)?.name ?? null : null }) : 'Todavía no generado' },
                { label: 'Factura generada', value: quote.invoice_id ? formatInvoiceLabel(invoiceById.get(quote.invoice_id) ?? { id: quote.invoice_id }) : 'Todavía no generada' },
              ],
              actions: [
                {
                  key: 'open-quote',
                  label: 'Ver presupuesto',
                  tone: 'primary',
                  onClick: () => onOpenQuoteDetail(quote.id),
                },
                ...(quote.property_id
                  ? [{
                      key: 'open-property',
                      label: 'Ver propiedad',
                      onClick: () => onOpenPropertyWorkspace(quote.property_id!),
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
          {relatedRecurringPlans.length > 0 ? (
            <article className="data-section">
              <div className="section-header page-header-actions">
                <div>
                  <h2>Automatizaciones recurrentes</h2>
                  <p>Se quedan aqui como control, pero no compiten con las facturas del cliente.</p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditingRecurringPlanId(null)
                    openAction('recurring')
                  }}
                >
                  Nueva automatizacion
                </button>
              </div>
              {recurringFeedback ? (
                <div className="cc-alert cc-alert--success">
                  <strong>Operacion correcta</strong>
                  <p>{recurringFeedback}</p>
                </div>
              ) : null}
              <div className="cc-client-workspace__focus-list">
                {relatedRecurringPlans.slice(0, 3).map((plan) => (
                  <article key={plan.id} className="cc-client-workspace__focus-card">
                    <span>Plan recurrente</span>
                    <strong>{formatRecurringPlanLabel(plan)}</strong>
                    <small>{getRecurringFrequencyLabel(plan.frequency)} · {plan.status} · siguiente {formatDateEs(plan.next_issue_date)}</small>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setEditingRecurringPlanId(plan.id)
                          openAction('recurring')
                        }}
                      >
                        Editar plan
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleRecurringPlanIssued(plan.id)}
                        disabled={plan.status !== 'active' || pendingRecurringPlanId === plan.id}
                      >
                        {pendingRecurringPlanId === plan.id ? 'Procesando...' : 'Emitir ahora'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ) : null}
          <WorkspaceRelationBrowser
            ariaLabel="Facturas del cliente"
            emptyTitle="Sin facturas"
            emptyDescription="Este cliente todavía no tiene facturas emitidas."
            items={relatedInvoices.map((invoice) => {
              const invoicePayments = paymentsByInvoiceId.get(invoice.id) ?? []
              const paymentSummary = buildInvoicePaymentSummary(invoice, invoicePayments)

              return {
                id: invoice.id,
                title: formatInvoiceLabel(invoice),
                subtitle: invoice.service_reference ?? invoice.job_display_code ?? invoice.property_name ?? 'Sin referencia operativa',
                statusLabel: getInvoiceFinancialStatusLabel(paymentSummary.financialStatus),
                context: invoice.notes?.trim() || 'Sin notas visibles en esta factura.',
                rowMeta: [
                  formatDateEs(invoice.issue_date),
                  formatCurrency(invoice.total),
                  `Pendiente ${formatCurrency(paymentSummary.outstandingAmount)}`,
                ],
                detailSummary: 'Factura del cliente y su estado real de cobro.',
                detailFields: [
                  { label: 'Emitida', value: formatDateEs(invoice.issue_date) },
                  { label: 'Total', value: formatCurrency(invoice.total) },
                  { label: 'Cobrado', value: formatCurrency(paymentSummary.paidAmount) },
                  { label: 'Pendiente', value: formatCurrency(paymentSummary.outstandingAmount) },
                  { label: 'Presupuesto origen', value: invoice.quote_id ? formatQuoteLabel(quoteById.get(invoice.quote_id) ?? { id: invoice.quote_id, display_code: invoice.quote_display_code, client_name: invoice.client_name, property_name: invoice.property_name }) : 'Sin presupuesto' },
                  { label: 'Propiedad', value: invoice.property_id ? formatPropertyLabel({ id: invoice.property_id, display_code: invoice.property_display_code, name: invoice.property_name }) : 'Sin propiedad' },
                ],
                actions: [
                  {
                    key: 'open-invoice',
                    label: 'Ver factura',
                    tone: 'primary',
                    onClick: () => onOpenInvoiceDetail(invoice.id),
                  },
                  ...(invoice.property_id
                    ? [{
                        key: 'open-property',
                        label: 'Ver propiedad',
                        onClick: () => onOpenPropertyWorkspace(invoice.property_id!),
                      }]
                    : []),
                  ...(invoice.quote_id
                    ? [{
                        key: 'open-quote',
                        label: 'Ver presupuesto',
                        onClick: () => onOpenQuoteDetail(invoice.quote_id!),
                      }]
                    : []),
                  ...(invoice.job_id
                    ? [{
                        key: 'open-job',
                        label: 'Ver servicio',
                        onClick: () => onOpenJobWorkspace(invoice.job_id!),
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
            ariaLabel="Cobros del cliente"
            emptyTitle="Sin cobros"
            emptyDescription="Todavía no se han registrado cobros para este cliente."
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
                  paymentInvoice?.job_id ? 'Con servicio' : 'Sin servicio',
                ],
                detailSummary: 'Cobro individual con acceso directo a la factura y al contexto operativo asociado.',
                detailFields: [
                  { label: 'Importe', value: formatCurrency(payment.amount) },
                  { label: 'Método', value: getPaymentMethodLabel(payment.payment_method) },
                  { label: 'Fecha', value: formatDateEs(payment.payment_date) },
                  { label: 'Factura', value: formatInvoiceLabel(paymentInvoice ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number }) },
                  { label: 'Servicio', value: paymentInvoice?.job_id ? formatJobLabel(relatedJobs.find((job) => job.id === paymentInvoice.job_id) ?? { id: paymentInvoice.job_id, display_code: paymentInvoice.job_display_code, client_name: paymentInvoice.client_name, property_name: paymentInvoice.property_name }) : 'Sin servicio asociado' },
                  { label: 'Propiedad', value: paymentInvoice?.property_id ? formatPropertyLabel({ id: paymentInvoice.property_id, display_code: paymentInvoice.property_display_code, name: paymentInvoice.property_name }) : 'Sin propiedad asociada' },
                ],
                actions: [
                  {
                    key: 'open-invoice',
                    label: 'Ver factura',
                    tone: 'primary',
                    onClick: () => onOpenInvoiceDetail(payment.invoice_id),
                  },
                  ...(paymentInvoice?.property_id
                    ? [{
                        key: 'open-property',
                        label: 'Ver propiedad',
                        onClick: () => onOpenPropertyWorkspace(paymentInvoice.property_id!),
                      }]
                    : []),
                  ...(paymentInvoice?.job_id
                    ? [{
                        key: 'open-job',
                        label: 'Ver servicio',
                        onClick: () => onOpenJobWorkspace(paymentInvoice.job_id!),
                      }]
                    : []),
                  ...(paymentInvoice?.quote_id
                    ? [{
                        key: 'open-quote',
                        label: 'Ver presupuesto',
                        onClick: () => onOpenQuoteDetail(paymentInvoice.quote_id!),
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
              <h2>Actividad</h2>
              <p>Secuencia real de presupuestos, servicios, facturas y cobros.</p>
            </div>

            <div className="cc-client-workspace__timeline">
              {activityItems.map((item) => (
                <article key={item.id} className={`cc-client-workspace__timeline-item cc-client-workspace__timeline-item--${item.tone}`}>
                  <span>{formatDateEs(item.date)}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
              {activityItems.length === 0 ? <p>Sin actividad histórica suficiente.</p> : null}
            </div>
          </article>

          <article className="data-section">
            <div className="section-header">
              <h2>Notas</h2>
              <p>Notas visibles e internas agregadas desde entidades relacionadas.</p>
            </div>

            <div className="cc-client-workspace__notes">
              {noteItems.map((note) => (
                <article key={note.id} className="cc-client-workspace__note-card">
                  <span>{note.label}</span>
                  <strong>{note.meta}</strong>
                  <p>{note.body}</p>
                </article>
              ))}
              {noteItems.length === 0 ? <p>No hay notas agregadas para este cliente.</p> : null}
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
          setEditingRecurringPlanId(null)
          setHasActionDirty(false)
        }}
      />
    </section>
  )
}
