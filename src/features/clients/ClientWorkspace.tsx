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
  formatJobLabel,
  formatPropertyLabel,
  formatQuoteLabel,
} from '../../app/relationshipLabels'
import { ClientDetailCard } from './ClientDetailCard'
import type { ClientWorkspaceTab } from './useClientWorkspaceNavigation'
import { clientWorkspaceTabs } from './useClientWorkspaceNavigation'
import type { ClientListItem } from './types'
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
    return `${client.source_lead_display_code} · ${client.source_lead_name}`
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

function buildInvoiceBalance(invoice: InvoiceListItem, payments: PaymentListItem[]) {
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  return {
    collected,
    outstanding: Number(invoice.total ?? 0) - collected,
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
  onPendingStateChange,
}: ClientWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<ClientWorkspaceAction>(null)
  const [editRequestToken, setEditRequestToken] = useState(0)
  const [archiveRequestToken, setArchiveRequestToken] = useState(0)
  const [isClientEditing, setIsClientEditing] = useState(false)
  const [editingRecurringPlanId, setEditingRecurringPlanId] = useState<string | null>(null)
  const [recurringFeedback, setRecurringFeedback] = useState<string | null>(null)

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

  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, PaymentListItem[]>()

    for (const payment of relatedPayments) {
      const currentItems = map.get(payment.invoice_id) ?? []
      currentItems.push(payment)
      map.set(payment.invoice_id, currentItems)
    }

    return map
  }, [relatedPayments])

  const totalInvoiced = useMemo(
    () => relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
    [relatedInvoices],
  )
  const totalCollected = useMemo(
    () => relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [relatedPayments],
  )
  const pendingBalance = totalInvoiced - totalCollected

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

  const todayTimestamp = toTimestamp(new Date().toISOString())
  const nextJob = sortedJobsAsc.find((job) => toTimestamp(job.scheduled_date) >= todayTimestamp && job.status !== 'cancelled') ?? null
  const latestJob = sortedJobsDesc.find((job) => toTimestamp(job.scheduled_date) <= todayTimestamp || job.status === 'completed')
    ?? sortedJobsDesc[0]
    ?? null

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
        detail: `${getStatusLabel(quote.status)} · ${formatCurrency(quote.total)}`,
        tone: quote.status === 'accepted' ? 'success' : 'info',
      })
    }

    for (const job of relatedJobs) {
      items.push({
        id: `job-${job.id}`,
        date: job.scheduled_date,
        title: `Servicio ${formatJobLabel(job)}`,
        detail: `${job.property_name ?? job.property_display_code ?? job.property_id} · ${getStatusLabel(job.status)}`,
        tone: job.status === 'completed' ? 'success' : 'warning',
      })
    }

    for (const invoice of relatedInvoices) {
      items.push({
        id: `invoice-${invoice.id}`,
        date: invoice.issue_date,
        title: `Factura ${invoice.invoice_number ?? invoice.display_code ?? invoice.id}`,
        detail: `${getStatusLabel(invoice.status)} · ${formatCurrency(invoice.total)}`,
        tone: invoice.status === 'paid' ? 'success' : 'warning',
      })
    }

    for (const payment of relatedPayments) {
      items.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        title: `Cobro ${payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}`,
        detail: `${formatCurrency(payment.amount)} · ${getPaymentMethodLabel(payment.payment_method)}`,
        tone: 'success',
      })
    }

    return items.sort((left, right) => compareByDateDesc(left.date, right.date))
  }, [client, relatedInvoices, relatedJobs, relatedPayments, relatedQuotes])

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
        meta: `${formatJobLabel(job)} · ${job.property_name ?? job.property_display_code ?? job.property_id}`,
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
        meta: invoice.invoice_number ?? invoice.display_code ?? invoice.id,
      })
    }

    for (const payment of relatedPayments) {
      if (!payment.notes?.trim()) continue
      items.push({
        id: `payment-note-${payment.id}`,
        label: 'Nota de cobro',
        body: payment.notes.trim(),
        meta: payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id,
      })
    }

    return items
  }, [relatedInvoices, relatedJobs, relatedPayments, relatedProperties, relatedQuotes])

  useEffect(() => {
    onPendingStateChange?.(Boolean(activeAction) || isClientEditing)
  }, [activeAction, isClientEditing, onPendingStateChange])

  function openAction(action: Exclude<ClientWorkspaceAction, null>) {
    setActiveAction(action)
    onTabChange(buildActionTab(action))
  }

  async function handleActionCreated() {
    await onRefresh()
    setActiveAction(null)
    setEditingRecurringPlanId(null)
  }

  async function handleRecurringPlanIssued(planId: string) {
    await generateInvoiceFromRecurringPlan(planId)
    await onRefresh()
    setRecurringFeedback('Factura recurrente emitida y plan actualizado.')
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
            <p>{formatClientLabel(client)} · {buildOriginLabel(client)}</p>
          </div>

          <div className="cc-client-workspace__status">
            <span className="lead-badge">{getDisplayStatusLabel(client.status)}</span>
            <span className="cc-client-workspace__status-meta">{client.tax_id ?? 'Sin NIF/CIF'}</span>
          </div>
        </div>

        <div className="cc-client-workspace__meta">
          <article className="cc-client-workspace__meta-card">
            <span>Contacto</span>
            <strong>{client.phone ?? 'Sin teléfono'}</strong>
            <small>{client.email ?? 'Sin email'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Origen</span>
            <strong>{buildOriginLabel(client)}</strong>
            <small>{client.source_lead_id ? 'Lead convertido' : 'Alta directa'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Dirección fiscal</span>
            <strong>{client.billing_address ?? 'Pendiente'}</strong>
            <small>{client.tax_id ?? 'Completa la ficha fiscal'}</small>
          </article>
        </div>
      </header>

      <section className="cc-client-workspace__snapshot">
        <article className="cc-client-workspace__snapshot-card">
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(pendingBalance)}</strong>
          <small>{pendingBalance > 0 ? 'Facturas con saldo abierto' : 'Sin saldo pendiente relevante'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Total facturado</span>
          <strong>{formatCurrency(totalInvoiced)}</strong>
          <small>{relatedInvoices.length} factura(s)</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Última factura</span>
          <strong>{latestInvoice ? formatCurrency(latestInvoice.total) : 'Sin facturas'}</strong>
          <small>{latestInvoice ? formatDateEs(latestInvoice.issue_date) : 'Aún no emitida'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Último servicio</span>
          <strong>{latestJob ? formatJobLabel(latestJob) : 'Sin servicios'}</strong>
          <small>{latestJob ? formatDateEs(latestJob.scheduled_date) : 'Sin histórico operativo'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Próximo servicio</span>
          <strong>{nextJob ? formatJobLabel(nextJob) : 'No programado'}</strong>
          <small>{nextJob ? formatDateEs(nextJob.scheduled_date) : 'Sin agenda futura'}</small>
        </article>
      </section>

      <section className="cc-client-workspace__actions">
        <button type="button" className="primary-button" onClick={() => openAction('property')}>
          Nueva propiedad
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('job')}>
          Nuevo servicio
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('quote')}>
          Nuevo presupuesto
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('invoice')}>
          Nueva factura
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setEditingRecurringPlanId(null)
            openAction('recurring')
          }}
        >
          Automatizar factura
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('payment')}>
          Registrar cobro
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            onTabChange('summary')
            setActiveAction(null)
            setEditRequestToken((current) => current + 1)
          }}
        >
          Editar cliente
        </button>
        {client.status !== 'inactive' ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onTabChange('summary')
              setActiveAction(null)
              setArchiveRequestToken((current) => current + 1)
            }}
          >
            Archivar cliente
          </button>
        ) : null}
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
        <section className="data-section cc-client-workspace__action-panel">
          <div className="section-header page-header-actions">
            <div>
              <h2>{getActionTitle(activeAction)}</h2>
              <p>La acción se guardará ya vinculada al cliente {formatClientLabel(client)}.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setActiveAction(null)}
            >
              Cerrar acción
            </button>
          </div>

          {activeAction === 'property' ? (
            <PropertyCreateForm
              key={`property-${client.id}`}
              clients={[client]}
              contextClientId={client.id}
              onCreated={handleActionCreated}
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
            />
          ) : null}

          {activeAction === 'quote' ? (
            <QuoteCreateForm
              key={`quote-${client.id}`}
              clients={[client]}
              properties={relatedProperties}
              contextClientId={client.id}
              onCreated={handleActionCreated}
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
            />
          ) : null}

          {activeAction === 'payment' ? (
            <PaymentCreateForm
              key={`payment-${client.id}`}
              invoices={relatedInvoices}
              onCreated={handleActionCreated}
            />
          ) : null}

          {activeAction === 'recurring' ? (
            <RecurringInvoicePlanForm
              key={`recurring-${editingRecurringPlanId ?? client.id}`}
              clientId={client.id}
              properties={relatedProperties}
              quotes={relatedQuotes}
              initialPlan={relatedRecurringPlans.find((plan) => plan.id === editingRecurringPlanId) ?? null}
              onSaved={handleActionCreated}
            />
          ) : null}
        </section>
      ) : null}

      {activeTab === 'summary' ? (
        <div className="cc-client-workspace__tab-panel">
          <section className="cc-client-workspace__summary-grid">
            <article className="data-section">
              <div className="section-header">
                <h2>Estado de cuenta</h2>
                <p>Lectura rápida del saldo, operaciones y documentos abiertos.</p>
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
                  <strong>{relatedInvoices.filter((invoice) => invoice.status === 'paid').length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Facturas pendientes</span>
                  <strong>{relatedInvoices.filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled').length}</strong>
                </div>
              </div>
            </article>

            <article className="data-section">
              <div className="section-header">
                <h2>Relación viva</h2>
                <p>Qué está ocurriendo ahora entre propiedades, servicios y documentos.</p>
              </div>

              <div className="cc-client-workspace__relationship-list">
                {relatedProperties.slice(0, 3).map((property) => (
                  <article key={property.id} className="cc-client-workspace__relationship-card">
                    <strong>{formatPropertyLabel(property)}</strong>
                    <span>{property.address}</span>
                    <small>
                      {jobsByPropertyId.get(property.id)?.length ?? 0} servicio(s) · {quotesByPropertyId.get(property.id)?.length ?? 0} presupuesto(s) · {invoicesByPropertyId.get(property.id)?.length ?? 0} factura(s)
                    </small>
                  </article>
                ))}
                {relatedProperties.length === 0 ? <p>Este cliente aún no tiene propiedades vinculadas.</p> : null}
              </div>
            </article>
            <article className="data-section">
              <div className="section-header">
                <h2>Automatizacion recurrente</h2>
                <p>Planes activos para emitir facturas repetitivas por cliente.</p>
              </div>

              <div className="cc-client-workspace__relationship-list">
                {relatedRecurringPlans.slice(0, 3).map((plan) => (
                  <article key={plan.id} className="cc-client-workspace__relationship-card">
                    <strong>{plan.title}</strong>
                    <span>{getRecurringFrequencyLabel(plan.frequency)} · {plan.status}</span>
                    <small>
                      Siguiente emision {formatDateEs(plan.next_issue_date)} · {plan.template_lines.length} linea(s)
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
          <div className="cc-client-workspace__entity-grid">
            {relatedProperties.map((property) => {
              const propertyJobs = jobsByPropertyId.get(property.id) ?? []
              const propertyQuotes = quotesByPropertyId.get(property.id) ?? []
              const propertyInvoices = invoicesByPropertyId.get(property.id) ?? []

              return (
                <article key={property.id} className="data-section cc-client-workspace__entity-card">
                  <div className="section-header">
                    <div>
                      <h2>{formatPropertyLabel(property)}</h2>
                      <p>{property.address}</p>
                    </div>
                    <span className="lead-badge">{getPropertyTypeLabel(property.property_type)}</span>
                  </div>

                  <div className="cc-client-workspace__entity-meta">
                    <span>{property.city ?? 'Sin ciudad'}</span>
                    <span>{property.postal_code ?? 'Sin código postal'}</span>
                    <span>{property.notes?.trim() || 'Sin notas operativas'}</span>
                  </div>

                  <div className="cc-client-workspace__inline-summary">
                    <span>{propertyJobs.length} servicio(s)</span>
                    <span>{propertyQuotes.length} presupuesto(s)</span>
                    <span>{propertyInvoices.length} factura(s)</span>
                  </div>

                  <div className="cc-client-workspace__nested-list">
                    {propertyJobs.map((job) => (
                      <article key={job.id} className="cc-client-workspace__nested-item">
                        <strong>{formatJobLabel(job)}</strong>
                        <span>{getServiceTypeLabel(job.service_type)} · {formatDateEs(job.scheduled_date)} · {getStatusLabel(job.status)}</span>
                        <small>
                          {job.quote_display_code ?? job.quote_id ?? 'Sin presupuesto'} · {job.invoice_id ?? 'Sin factura'}
                        </small>
                      </article>
                    ))}
                    {propertyJobs.length === 0 ? <p>Sin servicios vinculados a esta propiedad.</p> : null}
                  </div>
                </article>
              )
            })}
          </div>

          {relatedProperties.length === 0 ? (
            <div className="empty-state">
              <strong>Sin propiedades</strong>
              <p>Crea la primera propiedad para empezar a conectar servicios y documentos desde el workspace.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'jobs' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedJobs.map((job) => (
            <article key={job.id} className="data-section cc-client-workspace__entity-card">
              <div className="section-header">
                <div>
                  <h2>{formatJobLabel(job)}</h2>
                  <p>{job.property_name ?? job.property_display_code ?? job.property_id}</p>
                </div>
                <span className="lead-badge">{getStatusLabel(job.status)}</span>
              </div>

              <div className="cc-client-workspace__detail-stack">
                <div className="detail-row">
                  <span className="detail-label">Fecha</span>
                  <strong>{formatDateEs(job.scheduled_date)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tipo</span>
                  <strong>{getServiceTypeLabel(job.service_type)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Propiedad</span>
                  <strong>{job.property_name ?? job.property_display_code ?? job.property_id}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Presupuesto origen</span>
                  <strong>{job.quote_display_code ?? job.quote_id ?? 'Sin presupuesto'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Factura</span>
                  <strong>{job.invoice_id ?? 'Pendiente de facturar'}</strong>
                </div>
              </div>
            </article>
          ))}

          {relatedJobs.length === 0 ? (
            <div className="empty-state">
              <strong>Sin servicios</strong>
              <p>Este cliente todavía no tiene servicios registrados.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'quotes' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedQuotes.map((quote) => (
            <article key={quote.id} className="data-section cc-client-workspace__entity-card">
              <div className="section-header">
                <div>
                  <h2>{formatQuoteLabel(quote)}</h2>
                  <p>{quote.property_display_code ?? quote.property_id ?? 'Sin propiedad vinculada'}</p>
                </div>
                <span className="lead-badge">{getStatusLabel(quote.status)}</span>
              </div>

              <div className="cc-client-workspace__detail-stack">
                <div className="detail-row">
                  <span className="detail-label">Total</span>
                  <strong>{formatCurrency(quote.total)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Creado</span>
                  <strong>{formatDateEs(quote.created_at)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Servicio generado</span>
                  <strong>{quote.job_id ?? 'Todavía no generado'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Factura generada</span>
                  <strong>{quote.invoice_id ?? 'Todavía no generada'}</strong>
                </div>
              </div>
            </article>
          ))}

          {relatedQuotes.length === 0 ? (
            <div className="empty-state">
              <strong>Sin presupuestos</strong>
              <p>Este cliente todavía no tiene presupuestos asociados.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="cc-client-workspace__tab-panel">
          <section className="cc-client-workspace__summary-grid">
            <article className="data-section">
              <div className="section-header page-header-actions">
                <div>
                  <h2>Automatizaciones recurrentes</h2>
                  <p>Programacion reutilizable para clientes con facturacion repetitiva.</p>
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

              <div className="cc-client-workspace__relationship-list">
                {relatedRecurringPlans.map((plan) => (
                  <article key={plan.id} className="cc-client-workspace__relationship-card">
                    <strong>{plan.title}</strong>
                    <span>{getRecurringFrequencyLabel(plan.frequency)} · {plan.status}</span>
                    <small>
                      Proxima emision {formatDateEs(plan.next_issue_date)} · {formatCurrency(plan.template_lines.reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0))}
                    </small>
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
                        disabled={plan.status !== 'active'}
                      >
                        Emitir ahora
                      </button>
                    </div>
                  </article>
                ))}
                {relatedRecurringPlans.length === 0 ? <p>No hay automatizaciones recurrentes para este cliente.</p> : null}
              </div>
            </article>

            <article className="data-section">
              <div className="section-header">
                <h2>Estado de emision</h2>
                <p>Controla las automatizaciones que requieren accion operativa.</p>
              </div>

              <div className="cc-client-workspace__ledger-grid">
                <div className="detail-row">
                  <span className="detail-label">Planes activos</span>
                  <strong>{relatedRecurringPlans.filter((plan) => plan.status === 'active').length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Vencidos o para hoy</span>
                  <strong>{dueRecurringPlans.length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pausados</span>
                  <strong>{relatedRecurringPlans.filter((plan) => plan.status === 'paused').length}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Ultimo plan emitido</span>
                  <strong>{relatedRecurringPlans.find((plan) => plan.last_issued_at)?.title ?? 'Sin emisiones'}</strong>
                </div>
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedInvoices.map((invoice) => {
            const invoicePayments = paymentsByInvoiceId.get(invoice.id) ?? []
            const { collected, outstanding } = buildInvoiceBalance(invoice, invoicePayments)

            return (
              <article key={invoice.id} className="data-section cc-client-workspace__entity-card">
                <div className="section-header">
                  <div>
                    <h2>{invoice.invoice_number ?? invoice.display_code ?? invoice.id}</h2>
                    <p>{invoice.service_reference ?? invoice.job_display_code ?? 'Sin referencia operativa'}</p>
                  </div>
                  <span className="lead-badge">{getStatusLabel(invoice.status)}</span>
                </div>

                <div className="cc-client-workspace__detail-stack">
                  <div className="detail-row">
                    <span className="detail-label">Emitida</span>
                    <strong>{formatDateEs(invoice.issue_date)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Total</span>
                    <strong>{formatCurrency(invoice.total)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Cobrado</span>
                    <strong>{formatCurrency(collected)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pendiente</span>
                    <strong>{formatCurrency(outstanding)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Presupuesto origen</span>
                    <strong>{invoice.quote_display_code ?? invoice.quote_id ?? 'Sin presupuesto'}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Propiedad</span>
                    <strong>{invoice.property_name ?? invoice.property_display_code ?? 'Sin propiedad'}</strong>
                  </div>
                </div>
              </article>
            )
          })}

          {relatedInvoices.length === 0 ? (
            <div className="empty-state">
              <strong>Sin facturas</strong>
              <p>Este cliente todavía no tiene facturas emitidas.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'payments' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedPayments.map((payment) => (
            <article key={payment.id} className="data-section cc-client-workspace__entity-card">
              <div className="section-header">
                <div>
                  <h2>{payment.invoice_number ?? payment.invoice_display_code ?? payment.invoice_id}</h2>
                  <p>{formatDateEs(payment.payment_date)}</p>
                </div>
                <span className="lead-badge">{getPaymentMethodLabel(payment.payment_method)}</span>
              </div>

              <div className="cc-client-workspace__detail-stack">
                <div className="detail-row">
                  <span className="detail-label">Importe</span>
                  <strong>{formatCurrency(payment.amount)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Método</span>
                  <strong>{getPaymentMethodLabel(payment.payment_method)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Notas</span>
                  <strong>{payment.notes ?? 'Sin notas'}</strong>
                </div>
              </div>
            </article>
          ))}

          {relatedPayments.length === 0 ? (
            <div className="empty-state">
              <strong>Sin cobros</strong>
              <p>Todavía no se han registrado cobros para este cliente.</p>
            </div>
          ) : null}
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
    </section>
  )
}
