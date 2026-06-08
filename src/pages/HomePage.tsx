import type { AutomationAlertItem } from '../features/automation/types'
import type { AppView } from '../app/navigation'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { OperationalAction, OperationalIncident, OperationalQuickView } from '../features/dashboard/operationalControl'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { JobListItem } from '../features/jobs/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import { formatCurrency, formatDateEs, getDisplayStatusLabel } from '../app/displayFormat'
import { formatRecurringPlanLabel } from '../app/relationshipLabels'

interface HomePageProps {
  metrics: {
    leadsCount: number
    clientsCount: number
    propertiesCount: number
    quotesCount: number
    jobsCount: number
    invoicesCount: number
    paymentsCount: number
    expensesCount: number
    openQuotesCount: number
    scheduledJobsCount: number
    pendingInvoicesCount: number
    partiallyPaidInvoicesCount: number
    invoicedThisMonthTotal: number
    collectedThisMonthTotal: number
    outstandingReceivablesTotal: number
    completedJobsWithoutInvoiceCount: number
    acceptedQuotesWithoutJobCount: number
    unpaidInvoicesOlderThan7DaysCount: number
    sentQuotesOlderThan5DaysCount: number
    completedJobsWithoutInvoiceOlderThan2DaysCount: number
    jobsScheduledTodayCount: number
    jobsScheduledTomorrowCount: number
    dueRecurringPlansCount: number
    pausedRecurringPlansCount: number
    clientsWithPendingBalanceCount: number
    clientsMissingFiscalDataCount: number
    propertyAnomalyCount: number
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
    estimatedDeductibleVat: number
    estimatedDeductibleBase: number
    fiscalReviewExpensesCount: number
    fiscalRiskExpensesCount: number
    expensesMissingValidVatInvoiceCount: number
    expensesZeroEstimatedVatCount: number
  }
  agenda: {
    todayJobs: JobListItem[]
    tomorrowJobs: JobListItem[]
    upcomingJobs: JobListItem[]
  }
  clientBalanceLeaders: Array<{
    clientId: string
    clientLabel: string
    pendingAmount: number
    pendingInvoices: number
  }>
  dueRecurringPlans: RecurringInvoicePlanListItem[]
  onOpenJobWorkspace: (jobId: string) => void
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
  onOpenView: (view: AppView) => void
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
  alerts: AutomationAlertItem[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  operationalIncidents: OperationalIncident[]
  operationalQuickViews: OperationalQuickView[]
  onRunOperationalAction: (action: OperationalAction) => void
}

export function HomePage({
  metrics,
  agenda,
  clientBalanceLeaders,
  dueRecurringPlans,
  onOpenJobWorkspace,
  onOpenClientWorkspace,
  onOpenView,
  onRunKpiAction,
  alerts,
  onOpenAlert,
  operationalIncidents,
  operationalQuickViews,
  onRunOperationalAction,
}: HomePageProps) {
  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const urgentCollectionsCount = metrics.unpaidInvoicesOlderThan7DaysCount + metrics.partiallyPaidInvoicesCount
  const topIncident = operationalIncidents[0] ?? null
  const quickViewById = new Map(operationalQuickViews.map((view) => [view.id, view]))
  const urgentIncidents = operationalIncidents.filter((incident) => incident.severity !== 'info').slice(0, 6)
  const followUpIncidents = operationalIncidents.filter((incident) => incident.severity === 'info').slice(0, 5)
  const todayActionJobs = agenda.todayJobs.slice(0, 5)
  const nextActionJobs = agenda.tomorrowJobs.slice(0, 3)
  const pendingBillingView = quickViewById.get('pending-billing') ?? null
  const pendingCollectionsView = quickViewById.get('pending-collections') ?? null
  const partialCollectionsView = quickViewById.get('partial-collections') ?? null
  const recurringDueView = quickViewById.get('recurring-due') ?? null
  const acceptedWithoutJobView = quickViewById.get('quotes-without-conversion') ?? null
  const missingFiscalView = quickViewById.get('clients-missing-fiscal') ?? null
  const pendingBalanceView = quickViewById.get('clients-pending-balance') ?? null
  const overdueInternalView = quickViewById.get('overdue-internal') ?? null
  const pausedRecurringCount = metrics.pausedRecurringPlansCount
  const followUpAlerts = alerts
    .filter((alert) => alert.ruleId === 'public_intake_lead_drafts_pending' || alert.ruleId === 'quarter_closing_reminder')
    .slice(0, 3)
  const homePrimaryAction = topIncident
    ? {
        label: topIncident.primaryAction.label,
        summary: topIncident.summary,
        detail: topIncident.detail,
        onRun: () => onRunOperationalAction(topIncident.primaryAction),
      }
    : metrics.completedJobsWithoutInvoiceCount > 0
      ? {
          label: 'Facturar servicios pendientes',
          summary: `${metrics.completedJobsWithoutInvoiceCount} servicio(s) completados sin factura`,
          detail: 'Conviene cerrar hoy el paso de servicio a factura.',
          onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
        }
      : urgentCollectionsCount > 0
        ? {
            label: 'Revisar cobros pendientes',
            summary: `${urgentCollectionsCount} factura(s) requieren seguimiento`,
            detail: 'Prioriza las facturas abiertas y parciales antes de abrir otras vistas.',
            onRun: () => onRunKpiAction('outstanding_invoices'),
          }
        : {
            label: 'Atender agenda de hoy',
            summary: `${metrics.jobsScheduledTodayCount} servicio(s) previstos hoy`,
            detail: 'La operativa diaria esta estable; revisa primero la agenda de hoy.',
            onRun: () => onRunKpiAction('jobs_today'),
          }

  function runQuickView(view: OperationalQuickView | null) {
    if (!view) return
    onRunOperationalAction(view.action)
  }

  function renderIncidentCard(incident: OperationalIncident) {
    return (
      <article
        key={incident.id}
        className={`cc-dashboard-console-card cc-dashboard-console-card--incident cc-dashboard-console-card--${incident.severity}`}
      >
        <div className="cc-dashboard-console-card__top">
          <div>
            <span className="cc-dashboard-console-card__eyebrow">
              {incident.severity === 'critical' ? 'Urgente' : 'Prioridad'}
            </span>
            <h3>{incident.title}</h3>
          </div>
          <span className="lead-badge">{incident.entityLabel}</span>
        </div>
        <strong className="cc-dashboard-console-card__summary">{incident.summary}</strong>
        <p className="cc-dashboard-console-card__detail">{incident.detail}</p>
        <div className="cc-dashboard-console-card__actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onRunOperationalAction(incident.primaryAction)}
          >
            {incident.primaryAction.label}
          </button>
          {incident.secondaryAction ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => onRunOperationalAction(incident.secondaryAction!)}
            >
              {incident.secondaryAction.label}
            </button>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <section className="cc-dashboard-page">
      <header className="cc-dashboard-header">
        <div className="cc-dashboard-header__copy">
          <span className="cc-page-topline__eyebrow">CostaClean CRM</span>
          <h1 className="cc-page-topline__title">Centro de control diario</h1>
          <p className="cc-page-topline__text">
            Que toca hoy, que falta facturar o cobrar y que conviene vigilar.
          </p>
        </div>

        <div className="cc-dashboard-header__meta" aria-label="Resumen rapido">
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Hoy</span>
            <strong className="cc-dashboard-header__meta-value">{metrics.jobsScheduledTodayCount} servicio(s)</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Por facturar</span>
            <strong className="cc-dashboard-header__meta-value">{metrics.completedJobsWithoutInvoiceCount}</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Cobros urgentes</span>
            <strong className="cc-dashboard-header__meta-value">{urgentCollectionsCount}</strong>
          </div>
        </div>
      </header>

      <div className="cc-dashboard-stack cc-dashboard-stack--console">
        <section className="cc-dashboard-block cc-dashboard-block--incidents cc-dashboard-console-hero">
          <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
            <div>
              <h2>Que hago ahora</h2>
              <p>Una prioridad y tres colas reales.</p>
            </div>
            <span className="lead-badge">{criticalAlertsCount > 0 ? `${criticalAlertsCount} criticas` : 'Hoy'}</span>
          </div>

          <div className="cc-dashboard-console-hero__grid">
            <article className="cc-dashboard-console-primary">
              <div className="cc-dashboard-console-primary__top">
                <span className="cc-dashboard-console-primary__eyebrow">Prioridad dominante</span>
              </div>
              <h3>{homePrimaryAction.label}</h3>
              <strong className="cc-dashboard-console-primary__summary">{homePrimaryAction.summary}</strong>
              <p className="cc-dashboard-console-primary__detail">{homePrimaryAction.detail}</p>
              <div className="cc-dashboard-console-primary__actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={homePrimaryAction.onRun}
                >
                  {homePrimaryAction.label}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onOpenView('alerts')}
                >
                  Ver alertas
                </button>
              </div>
            </article>

            <div className="cc-dashboard-console-lanes">
              {[pendingBillingView, pendingCollectionsView, recurringDueView].filter(Boolean).map((view) => (
                <button
                  key={view!.id}
                  type="button"
                  className={`cc-dashboard-console-lane cc-dashboard-console-lane--${view!.tone}`}
                  onClick={() => runQuickView(view!)}
                >
                  <span className="cc-dashboard-console-lane__label">{view!.label}</span>
                  <strong className="cc-dashboard-console-lane__value">{view!.value}</strong>
                  <p className="cc-dashboard-console-lane__detail">{view!.summary}</p>
                  <span className="cc-dashboard-console-lane__cta">{view!.action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Urgente hoy</h2>
              <p>Bloqueos reales antes del resto.</p>
            </div>
          </div>

          {urgentIncidents.length === 0 ? (
            <div className="empty-state">
              <strong>Sin urgencias activas</strong>
              <p>No hay bloqueos criticos o prioritarios fuera de la agenda de hoy.</p>
            </div>
          ) : (
            <div className="cc-dashboard-console-grid">
              {urgentIncidents.map((incident) => renderIncidentCard(incident))}
            </div>
          )}
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Trabajo de hoy</h2>
              <p>Agenda, facturacion y cobro en una sola capa.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-work">
            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Agenda inmediata</span>
                <h3>Servicios de hoy</h3>
                <p>{todayActionJobs.length > 0 ? 'Abrir, ejecutar y cerrar la agenda de hoy.' : 'Sin agenda hoy; manda facturacion, cobro o seguimiento.'}</p>
              </div>

              <div className="cc-dashboard-console-joblist">
                {todayActionJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className="cc-dashboard-console-job"
                    onClick={() => onOpenJobWorkspace(job.id)}
                  >
                    <div className="cc-dashboard-console-job__top">
                      <strong>{job.billing_concept?.trim() || job.display_code || job.id}</strong>
                      <span className="lead-badge">{getDisplayStatusLabel(job.status)}</span>
                    </div>
                    <p>{job.client_name ?? job.client_display_code} · {job.property_name ?? job.property_display_code}</p>
                    <div className="cc-dashboard-console-job__meta">
                      <span>{formatDateEs(job.scheduled_date)}</span>
                      <span>Abrir servicio</span>
                    </div>
                  </button>
                ))}
                {todayActionJobs.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin agenda de hoy</strong>
                    <p>La prioridad pasa a facturacion, cobro o seguimiento.</p>
                  </div>
                ) : null}
              </div>

              {nextActionJobs.length > 0 ? (
                <div className="cc-dashboard-console-subqueue">
                  <span className="cc-dashboard-console-subqueue__label">Despues de hoy</span>
                  {nextActionJobs.map((job) => (
                    <button key={job.id} type="button" className="cc-dashboard-console-subqueue__item" onClick={() => onOpenJobWorkspace(job.id)}>
                      <strong>{job.billing_concept?.trim() || job.display_code || job.id}</strong>
                      <span>{formatDateEs(job.scheduled_date)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Dinero pendiente</span>
                <h3>Facturar y cobrar</h3>
                <p>Accesos directos para cerrar ingresos.</p>
              </div>

              <div className="cc-dashboard-console-queuegrid">
                {[pendingBillingView, pendingCollectionsView, partialCollectionsView, overdueInternalView].filter(Boolean).map((view) => (
                  <button
                    key={view!.id}
                    type="button"
                    className={`cc-dashboard-console-queue cc-dashboard-console-queue--${view!.tone}`}
                    onClick={() => runQuickView(view!)}
                  >
                    <span>{view!.label}</span>
                    <strong>{view!.value}</strong>
                    <p>{view!.summary}</p>
                    <small>{view!.action.label}</small>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Seguimiento</h2>
              <p>Lo que conviene vigilar hoy.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-followup">
            <div className="cc-dashboard-console-followup__grid">
              {[acceptedWithoutJobView, missingFiscalView, pendingBalanceView].filter(Boolean).map((view) => (
                <button
                  key={view!.id}
                  type="button"
                  className={`cc-dashboard-console-followupcard cc-dashboard-console-followupcard--${view!.tone}`}
                  onClick={() => runQuickView(view!)}
                >
                  <span>{view!.label}</span>
                  <strong>{view!.value}</strong>
                  <p>{view!.summary}</p>
                  <small>{view!.action.label}</small>
                </button>
              ))}

              <article className="cc-dashboard-console-followupcard cc-dashboard-console-followupcard--info">
                <span>Automatizaciones pausadas</span>
                <strong>{pausedRecurringCount}</strong>
                <p>Planes detenidos que conviene reactivar o cerrar.</p>
                <small>{pausedRecurringCount > 0 ? 'Abrir clientes con seguimiento' : 'Sin planes pausados relevantes'}</small>
              </article>
            </div>

            <div className="cc-dashboard-console-side">
              <article className="cc-dashboard-console-sidepanel">
                <div className="cc-dashboard-console-sidepanel__header">
                  <h3>Clientes que necesitan atencion</h3>
                  <p>Saldo abierto con acceso directo a cobros.</p>
                </div>
                <div className="cc-dashboard-console-clientlist">
                  {clientBalanceLeaders.map((entry) => (
                    <button
                      key={entry.clientId}
                      type="button"
                      className="cc-dashboard-console-client"
                      onClick={() => onOpenClientWorkspace(entry.clientId, 'payments')}
                    >
                      <div className="cc-dashboard-console-client__top">
                        <strong>{entry.clientLabel}</strong>
                        <span>{formatCurrency(entry.pendingAmount)}</span>
                      </div>
                      <p>{entry.pendingInvoices} factura(s) abiertas</p>
                    </button>
                  ))}
                  {clientBalanceLeaders.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin cartera pendiente relevante</strong>
                      <p>No hay clientes con saldo abierto para seguimiento inmediato.</p>
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="cc-dashboard-console-sidepanel">
                <div className="cc-dashboard-console-sidepanel__header">
                  <h3>Automatizaciones y alertas</h3>
                  <p>Recurrentes listas y alertas no urgentes.</p>
                </div>
                <div className="cc-dashboard-console-alertlist">
                  {dueRecurringPlans.slice(0, 3).map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className="cc-dashboard-console-alert"
                      onClick={() => onOpenClientWorkspace(plan.client_id, 'invoices')}
                    >
                      <span>Recurrente lista</span>
                      <strong>{formatRecurringPlanLabel(plan)}</strong>
                      <p>{plan.property_name ?? plan.client_name ?? 'Plan recurrente'} · {formatDateEs(plan.next_issue_date)}</p>
                    </button>
                  ))}
                  {followUpAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      className="cc-dashboard-console-alert"
                      onClick={() => onOpenAlert(alert)}
                    >
                      <span>Alerta del sistema</span>
                      <strong>{alert.title}</strong>
                      <p>{alert.summary}</p>
                    </button>
                  ))}
                  {dueRecurringPlans.length === 0 && followUpAlerts.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin seguimientos de sistema</strong>
                      <p>No hay alertas suaves ni automatizaciones listas fuera de la cola principal.</p>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          </div>

          {followUpIncidents.length > 0 ? (
            <div className="cc-dashboard-console-footnotes">
              {followUpIncidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  className="cc-dashboard-console-footnote"
                  onClick={() => onRunOperationalAction(incident.primaryAction)}
                >
                  <strong>{incident.title}</strong>
                  <span>{incident.summary}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
