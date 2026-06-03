import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs, getPaymentMethodLabel, getPropertyTypeLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { InvoiceCreatePrefill } from '../invoices/invoiceCreatePrefill'
import { InvoiceCreateForm } from '../invoices/InvoiceCreateForm'
import { buildInvoicePaymentSummary, getInvoiceFinancialStatusLabel } from '../invoices/paymentState'
import type { InvoiceListItem } from '../invoices/types'
import { JobCreateForm } from '../jobs/JobCreateForm'
import type { JobCreatePrefill } from '../jobs/jobCreatePrefill'
import type { JobListItem } from '../jobs/types'
import { PaymentCreateForm } from '../payments/PaymentCreateForm'
import type { PaymentListItem } from '../payments/types'
import { PropertyDetailCard } from './PropertyDetailCard'
import type { PropertyWorkspaceTab } from './usePropertyWorkspaceNavigation'
import { propertyWorkspaceTabs } from './usePropertyWorkspaceNavigation'
import { QuoteCreateForm } from '../quotes/QuoteCreateForm'
import type { QuoteListItem } from '../quotes/types'
import { formatClientLabel, formatInvoiceLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from './types'

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
  onPendingStateChange,
}: PropertyWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<PropertyWorkspaceAction>(null)
  const [editRequestToken, setEditRequestToken] = useState(0)
  const [hasPendingDetailState, setHasPendingDetailState] = useState(false)

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
  const sortedJobsDesc = useMemo(
    () => [...relatedJobs].sort((left, right) => right.scheduled_date.localeCompare(left.scheduled_date)),
    [relatedJobs],
  )
  const sortedInvoicesDesc = useMemo(
    () => [...relatedInvoices].sort((left, right) => right.issue_date.localeCompare(left.issue_date)),
    [relatedInvoices],
  )

  const latestJob = sortedJobsDesc[0] ?? null
  const nextJob = sortedJobsAsc.find((job) => job.status !== 'cancelled' && job.scheduled_date >= new Date().toISOString().slice(0, 10)) ?? null
  const latestInvoice = sortedInvoicesDesc[0] ?? null
  const totalInvoiced = relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)
  const totalCollected = relatedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  const pendingBalance = totalInvoiced - totalCollected

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

  useEffect(() => {
    onPendingStateChange?.(Boolean(activeAction) || hasPendingDetailState)
  }, [activeAction, hasPendingDetailState, onPendingStateChange])

  async function handleActionCreated() {
    await onRefresh()
    setActiveAction(null)
  }

  function openAction(action: Exclude<PropertyWorkspaceAction, null>) {
    setActiveAction(action)
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
            <span>Ubicacion</span>
            <strong>{property.city ?? 'Sin ciudad'}</strong>
            <small>{property.postal_code ?? 'Sin codigo postal'}</small>
          </article>
          <article className="cc-client-workspace__meta-card">
            <span>Notas operativas</span>
            <strong>{property.notes?.trim() || 'Sin notas'}</strong>
            <small>{property.address}</small>
          </article>
        </div>
      </header>

      <section className="cc-client-workspace__snapshot">
        <article className="cc-client-workspace__snapshot-card">
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(pendingBalance)}</strong>
          <small>{pendingBalance > 0 ? 'Facturas con cobro pendiente' : 'Sin saldo pendiente relevante'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Total facturado</span>
          <strong>{formatCurrency(totalInvoiced)}</strong>
          <small>{relatedInvoices.length} factura(s)</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Ultima factura</span>
          <strong>{latestInvoice ? formatInvoiceLabel(latestInvoice) : 'Sin facturas'}</strong>
          <small>{latestInvoice ? formatDateEs(latestInvoice.issue_date) : 'Aun no emitida'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Ultimo servicio</span>
          <strong>{latestJob ? formatJobLabel(latestJob) : 'Sin servicios'}</strong>
          <small>{latestJob ? formatDateEs(latestJob.scheduled_date) : 'Sin historico operativo'}</small>
        </article>
        <article className="cc-client-workspace__snapshot-card">
          <span>Proximo servicio</span>
          <strong>{nextJob ? formatJobLabel(nextJob) : 'No programado'}</strong>
          <small>{nextJob ? formatDateEs(nextJob.scheduled_date) : 'Sin agenda futura'}</small>
        </article>
      </section>

      <section className="cc-client-workspace__actions">
        <button type="button" className="primary-button" onClick={() => openAction('job')}>
          Nuevo servicio
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('quote')}>
          Nuevo presupuesto
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('invoice')}>
          Nueva factura
        </button>
        <button type="button" className="secondary-button" onClick={() => openAction('payment')}>
          Registrar cobro
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            onTabChange('summary')
            setEditRequestToken((current) => current + 1)
          }}
        >
          Editar propiedad
        </button>
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
        <section className="data-section cc-client-workspace__action-panel">
          <div className="section-header page-header-actions">
            <div>
              <h2>{getActionTitle(activeAction)}</h2>
              <p>La accion se guardara vinculada a {formatPropertyLabel(property)} y {owner ? formatClientLabel(owner) : 'sin cliente'}.</p>
            </div>

            <button type="button" className="secondary-button" onClick={() => setActiveAction(null)}>
              Cerrar accion
            </button>
          </div>

          {activeAction === 'job' ? (
            <JobCreateForm
              key={`property-job-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
              prefill={jobPrefill}
            />
          ) : null}

          {activeAction === 'quote' ? (
            <QuoteCreateForm
              key={`property-quote-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              contextClientId={property.client_id}
              contextPropertyId={property.id}
              onCreated={handleActionCreated}
            />
          ) : null}

          {activeAction === 'invoice' ? (
            <InvoiceCreateForm
              key={`property-invoice-${property.id}`}
              clients={owner ? [owner] : clients}
              properties={[property]}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
              prefill={invoicePrefill}
            />
          ) : null}

          {activeAction === 'payment' ? (
            <PaymentCreateForm
              key={`property-payment-${property.id}`}
              invoices={relatedInvoices}
              clients={owner ? [owner] : clients}
              properties={[property]}
              jobs={relatedJobs}
              quotes={relatedQuotes}
              onCreated={handleActionCreated}
            />
          ) : null}
        </section>
      ) : null}

      {activeTab === 'summary' ? (
        <div className="cc-client-workspace__tab-panel">
          <section className="cc-client-workspace__summary-grid">
            <article className="data-section">
              <div className="section-header">
                <h2>Lectura operativa</h2>
                <p>Estado financiero y densidad de actividad de esta propiedad.</p>
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
                <h2>Relaciones vivas</h2>
                <p>Documentos y operaciones activas sobre el inmueble.</p>
              </div>

              <div className="cc-client-workspace__relationship-list">
                {relatedQuotes.slice(0, 2).map((quote) => (
                  <article key={quote.id} className="cc-client-workspace__relationship-card">
                    <strong>{formatQuoteLabel(quote)}</strong>
                    <span>{getStatusLabel(quote.status)}</span>
                    <small>{formatCurrency(quote.total)}</small>
                  </article>
                ))}
                {relatedJobs.slice(0, 2).map((job) => (
                  <article key={job.id} className="cc-client-workspace__relationship-card">
                    <strong>{formatJobLabel(job)}</strong>
                    <span>{getStatusLabel(job.status)}</span>
                    <small>{formatDateEs(job.scheduled_date)}</small>
                  </article>
                ))}
                {relatedInvoices.length === 0 && relatedQuotes.length === 0 && relatedJobs.length === 0 ? (
                  <p>Esta propiedad aun no tiene actividad relacional relevante.</p>
                ) : null}
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
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedJobs.map((job) => (
            <article key={job.id} className="data-section cc-client-workspace__entity-card">
              <div className="section-header">
                <div>
                  <h2>{formatJobLabel(job)}</h2>
                  <p>{getServiceTypeLabel(job.service_type)}</p>
                </div>
                <span className="lead-badge">{getStatusLabel(job.status)}</span>
              </div>

              <div className="cc-client-workspace__detail-stack">
                <div className="detail-row">
                  <span className="detail-label">Fecha</span>
                  <strong>{formatDateEs(job.scheduled_date)}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Cliente</span>
                  <strong>{owner ? formatClientLabel(owner) : 'Sin cliente'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Presupuesto origen</span>
                  <strong>{job.quote_id ? formatQuoteLabel(quoteById.get(job.quote_id) ?? { id: job.quote_id, display_code: job.quote_display_code, client_name: owner?.full_name ?? null, property_name: property.name }) : 'Sin presupuesto'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Factura</span>
                  <strong>{job.invoice_id ? formatInvoiceLabel(invoiceById.get(job.invoice_id) ?? { id: job.invoice_id }) : 'Pendiente de facturar'}</strong>
                </div>
              </div>
            </article>
          ))}

          {relatedJobs.length === 0 ? (
            <div className="empty-state">
              <strong>Sin servicios</strong>
              <p>Esta propiedad todavía no tiene servicios vinculados.</p>
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
                  <p>{owner ? formatClientLabel(owner) : 'Sin cliente'}</p>
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
                  <strong>{quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Servicio generado</span>
                  <strong>{quote.job_id ? formatJobLabel(relatedJobs.find((job) => job.id === quote.job_id) ?? { id: quote.job_id, client_name: owner?.full_name ?? null, property_name: property.name }) : 'Todavía no generado'}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Factura generada</span>
                  <strong>{quote.invoice_id ? formatInvoiceLabel(invoiceById.get(quote.invoice_id) ?? { id: quote.invoice_id }) : 'Todavía no generada'}</strong>
                </div>
              </div>
            </article>
          ))}

          {relatedQuotes.length === 0 ? (
            <div className="empty-state">
              <strong>Sin presupuestos</strong>
              <p>Esta propiedad todavía no tiene presupuestos asociados.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="cc-client-workspace__tab-panel cc-client-workspace__entity-grid">
          {relatedInvoices.map((invoice) => {
            const invoicePayments = relatedPayments.filter((payment) => payment.invoice_id === invoice.id)
            const paymentSummary = buildInvoicePaymentSummary(invoice, invoicePayments)
            return (
              <article key={invoice.id} className="data-section cc-client-workspace__entity-card">
                <div className="section-header">
                  <div>
                    <h2>{formatInvoiceLabel(invoice)}</h2>
                    <p>{owner ? formatClientLabel(owner) : 'Sin cliente'}</p>
                  </div>
                  <span className="lead-badge">{getInvoiceFinancialStatusLabel(paymentSummary.financialStatus)}</span>
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
                    <strong>{formatCurrency(paymentSummary.paidAmount)}</strong>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pendiente</span>
                    <strong>{formatCurrency(paymentSummary.outstandingAmount)}</strong>
                  </div>
                </div>
              </article>
            )
          })}

          {relatedInvoices.length === 0 ? (
            <div className="empty-state">
              <strong>Sin facturas</strong>
              <p>Esta propiedad todavía no tiene facturas emitidas.</p>
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
                  <h2>{formatInvoiceLabel(invoiceById.get(payment.invoice_id) ?? { id: payment.invoice_id, display_code: payment.invoice_display_code, invoice_number: payment.invoice_number })}</h2>
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
                  <span className="detail-label">Metodo</span>
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
              <p>Todavía no se han registrado cobros relacionados con esta propiedad.</p>
            </div>
          ) : null}
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
    </section>
  )
}
