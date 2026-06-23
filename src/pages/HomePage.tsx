import { getAlertActionLabel, getAlertImpactCopy } from '../features/automation/alertPresentation'
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
  const urgentIncidents = operationalIncidents.filter((incident) => incident.severity !== 'info').slice(0, 4)
  const followUpIncidents = operationalIncidents.filter((incident) => incident.severity === 'info').slice(0, 4)
  const todayActionJobs = agenda.todayJobs.slice(0, 4)
  const nextActionJobs = agenda.tomorrowJobs.slice(0, 2)
  const pendingBillingView = quickViewById.get('pending-billing') ?? null
  const pendingCollectionsView = quickViewById.get('pending-collections') ?? null
  const partialCollectionsView = quickViewById.get('partial-collections') ?? null
  const recurringDueView = quickViewById.get('recurring-due') ?? null
  const acceptedWithoutJobView = quickViewById.get('quotes-without-conversion') ?? null
  const missingFiscalView = quickViewById.get('clients-missing-fiscal') ?? null
  const pendingBalanceView = quickViewById.get('clients-pending-balance') ?? null
  const overdueInternalView = quickViewById.get('overdue-internal') ?? null
  const followUpAlerts = alerts
    .filter((alert) => alert.ruleId === 'public_intake_lead_drafts_pending' || alert.ruleId === 'quarter_closing_reminder')
    .slice(0, 3)

  const homePrimaryAction = topIncident
    ? {
        eyebrow: topIncident.severity === 'critical' ? 'Bloqueo principal' : 'Prioridad principal',
        label: topIncident.primaryAction.label,
        summary: topIncident.summary,
        detail: topIncident.detail,
        onRun: () => onRunOperationalAction(topIncident.primaryAction),
        secondaryLabel: topIncident.secondaryAction?.label ?? 'Ver alertas',
        onSecondaryRun: () => (
          topIncident.secondaryAction
            ? onRunOperationalAction(topIncident.secondaryAction)
            : onOpenView('alerts')
        ),
      }
    : metrics.completedJobsWithoutInvoiceCount > 0
      ? {
          eyebrow: 'Prioridad principal',
          label: 'Facturar servicios pendientes',
          summary: `${metrics.completedJobsWithoutInvoiceCount} servicio(s) completados sin factura`,
          detail: 'Conviene cerrar hoy el paso de servicio a factura para no bloquear ingreso.',
          onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
          secondaryLabel: 'Ver servicios de hoy',
          onSecondaryRun: () => onRunKpiAction('jobs_today'),
        }
      : urgentCollectionsCount > 0
        ? {
            eyebrow: 'Prioridad principal',
            label: 'Revisar cobros pendientes',
            summary: `${urgentCollectionsCount} factura(s) requieren seguimiento`,
            detail: 'Prioriza las facturas vencidas y las parciales antes de abrir mas frentes.',
            onRun: () => onRunKpiAction('outstanding_invoices'),
            secondaryLabel: 'Abrir alertas',
            onSecondaryRun: () => onOpenView('alerts'),
          }
        : {
            eyebrow: 'Prioridad principal',
            label: 'Atender agenda de hoy',
            summary: `${metrics.jobsScheduledTodayCount} servicio(s) previstos hoy`,
            detail: 'La operativa esta estable; conviene empezar por agenda y siguiente accion.',
            onRun: () => onRunKpiAction('jobs_today'),
            secondaryLabel: 'Ver siguiente cola',
            onSecondaryRun: () => onOpenView('alerts'),
          }

  const moneyQueue = [pendingBillingView, overdueInternalView, pendingCollectionsView, partialCollectionsView].filter(Boolean)
  const decisionKpis = [
    {
      label: 'Pendiente de facturar',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      detail: 'Servicios ya ejecutados que aun no pasan a factura.',
      tone: 'warning',
      onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
    },
    {
      label: 'Pendiente de cobrar',
      value: formatCurrency(metrics.outstandingReceivablesTotal),
      detail: `${metrics.pendingInvoicesCount} factura(s) siguen abiertas.`,
      tone: 'warning',
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      label: 'Servicios hoy',
      value: String(metrics.jobsScheduledTodayCount),
      detail: metrics.jobsScheduledTodayCount > 0 ? 'Agenda inmediata para ejecutar.' : 'Sin carga operativa para hoy.',
      tone: 'info',
      onRun: () => onRunKpiAction('jobs_today'),
    },
    {
      label: 'Presupuestos sin convertir',
      value: String(metrics.acceptedQuotesWithoutJobCount),
      detail: 'Venta aceptada que aun no se ha convertido en servicio.',
      tone: 'warning',
      onRun: () => onRunKpiAction('accepted_quotes_without_job'),
    },
    {
      label: 'Recurrentes listas',
      value: String(metrics.dueRecurringPlansCount),
      detail: metrics.dueRecurringPlansCount > 0 ? 'Facturacion automatica lista para emitir.' : 'Sin emisiones recurrentes pendientes.',
      tone: 'info',
      onRun: () => recurringDueView ? onRunOperationalAction(recurringDueView.action) : onOpenView('clients'),
    },
    {
      label: 'Clientes con saldo',
      value: String(metrics.clientsWithPendingBalanceCount),
      detail: 'Cartera viva con seguimiento de cobro abierto.',
      tone: 'info',
      onRun: () => pendingBalanceView ? onRunOperationalAction(pendingBalanceView.action) : onOpenView('clients'),
    },
  ]

  const quickActions = [
    {
      title: 'Nuevo presupuesto',
      detail: 'Abrir propuesta comercial.',
      tone: 'primary',
      onRun: () => onOpenView('quotes'),
    },
    {
      title: 'Nuevo servicio',
      detail: 'Crear trabajo operativo.',
      tone: 'default',
      onRun: () => onOpenView('jobs'),
    },
    {
      title: 'Nueva factura',
      detail: 'Emitir o revisar facturacion.',
      tone: 'default',
      onRun: () => onOpenView('invoices'),
    },
    {
      title: 'Registrar cobro',
      detail: 'Ir a cobros del periodo.',
      tone: 'default',
      onRun: () => onOpenView('payments'),
    },
    {
      title: 'Cierre fiscal',
      detail: 'Revisar periodo y exporte.',
      tone: 'default',
      onRun: () => onOpenView('fiscal_closing'),
    },
  ]

  function runQuickView(view: OperationalQuickView | null) {
    if (!view) return
    onRunOperationalAction(view.action)
  }

  function renderIncidentButton(incident: OperationalIncident) {
    return (
      <button
        key={incident.id}
        type="button"
        className={`cc-dashboard-console-action cc-dashboard-console-action--${incident.severity}`}
        onClick={() => onRunOperationalAction(incident.primaryAction)}
      >
        <div className="cc-dashboard-console-action__top">
          <span>{incident.severity === 'critical' ? 'Critico' : 'Accion requerida'}</span>
          <strong>{incident.primaryAction.label}</strong>
        </div>
        <h3>{incident.title}</h3>
        <p>{incident.summary}</p>
      </button>
    )
  }

  return (
    <section className="cc-dashboard-page">
      <header className="cc-dashboard-header cc-dashboard-header--decision">
        <div className="cc-dashboard-header__copy">
          <span className="cc-page-topline__eyebrow">Centro operativo</span>
          <h1 className="cc-page-topline__title">Que hago ahora</h1>
          <p className="cc-page-topline__text">
            Prioridad del dia, dinero bloqueado, agenda inmediata y seguimientos que no conviene dejar caer.
          </p>
        </div>

        <div className="cc-dashboard-header__meta cc-dashboard-header__meta--decision" aria-label="Resumen rapido">
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Hoy</span>
            <strong className="cc-dashboard-header__meta-value">{metrics.jobsScheduledTodayCount} servicio(s)</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Dinero pendiente</span>
            <strong className="cc-dashboard-header__meta-value">{formatCurrency(metrics.outstandingReceivablesTotal)}</strong>
          </div>
          <div className="cc-dashboard-header__meta-card">
            <span className="cc-dashboard-header__meta-label">Alertas criticas</span>
            <strong className="cc-dashboard-header__meta-value">{criticalAlertsCount}</strong>
          </div>
        </div>
      </header>

      <div className="cc-dashboard-stack cc-dashboard-stack--console cc-dashboard-stack--decision">
        <section className="cc-dashboard-block cc-dashboard-console-hero cc-dashboard-console-hero--decision">
          <div className="cc-dashboard-console-hero__grid cc-dashboard-console-hero__grid--decision">
            <article className="cc-dashboard-console-primary cc-dashboard-console-primary--decision">
              <div className="cc-dashboard-console-primary__top">
                <span className="cc-dashboard-console-primary__eyebrow">{homePrimaryAction.eyebrow}</span>
                <span className="lead-badge">{criticalAlertsCount > 0 ? `${criticalAlertsCount} criticas` : 'Operativa estable'}</span>
              </div>
              <h3>{homePrimaryAction.label}</h3>
              <strong className="cc-dashboard-console-primary__summary">{homePrimaryAction.summary}</strong>
              <p className="cc-dashboard-console-primary__detail">{homePrimaryAction.detail}</p>
              <div className="cc-dashboard-console-primary__actions">
                <button type="button" className="primary-button" onClick={homePrimaryAction.onRun}>
                  {homePrimaryAction.label}
                </button>
                <button type="button" className="secondary-button" onClick={homePrimaryAction.onSecondaryRun}>
                  {homePrimaryAction.secondaryLabel}
                </button>
              </div>
            </article>

            <article className="cc-dashboard-console-sidepanel cc-dashboard-console-sidepanel--decision">
              <div className="cc-dashboard-console-sidepanel__header">
                <h3>Dinero y conversion</h3>
                <p>Las colas que mas cambian caja y ritmo operativo.</p>
              </div>
              <div className="cc-dashboard-console-lanes">
                {moneyQueue.map((view) => (
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
            </article>
          </div>

          <div className="cc-dashboard-console-kpis">
            {decisionKpis.map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                className={`cc-dashboard-console-kpi cc-dashboard-console-kpi--${kpi.tone}`}
                onClick={kpi.onRun}
              >
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <p>{kpi.detail}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Cola operativa corta</h2>
              <p>Lo mas importante para mover trabajo, dinero y proximo paso sin leer media pantalla.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-operating-grid">
            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Accion requerida</span>
                <h3>Lo que bloquea hoy</h3>
                <p>{urgentIncidents.length > 0 ? 'Ataca primero estas incidencias operativas.' : 'No hay bloqueos duros fuera de la cola de dinero.'}</p>
              </div>

              {urgentIncidents.length > 0 ? (
                <div className="cc-dashboard-console-actionlist cc-bounded-list">
                  {urgentIncidents.map((incident) => renderIncidentButton(incident))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Sin bloqueos urgentes</strong>
                  <p>La prioridad puede pasar a agenda, cobro o seguimiento comercial.</p>
                </div>
              )}
            </article>

            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Agenda inmediata</span>
                <h3>Hoy y lo siguiente</h3>
                <p>Servicios listos para abrir y siguiente paso despues de cerrar hoy.</p>
              </div>

              <div className="cc-dashboard-console-joblist cc-bounded-list">
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
                    <p>No hay servicios agendados para hoy.</p>
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
                <span className="cc-dashboard-console-workpanel__eyebrow">Accesos utiles</span>
                <h3>Acciones rapidas</h3>
                <p>Pocas acciones, pero las que de verdad deberian estar a mano.</p>
              </div>

              <div className="cc-dashboard-console-quickactions">
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    className={action.tone === 'primary' ? 'cc-dashboard-console-quickaction cc-dashboard-console-quickaction--primary' : 'cc-dashboard-console-quickaction'}
                    onClick={action.onRun}
                  >
                    <strong>{action.title}</strong>
                    <span>{action.detail}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Seguimiento y contexto</h2>
              <p>Lo que conviene vigilar sin convertir el home en una pared de widgets.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-support-grid">
            <article className="cc-dashboard-console-sidepanel">
              <div className="cc-dashboard-console-sidepanel__header">
                <h3>Clientes con dinero pendiente</h3>
                <p>Abre directamente la cartera mas expuesta.</p>
              </div>
              <div className="cc-dashboard-console-clientlist cc-bounded-list">
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
                <h3>Recurrentes y revision</h3>
                <p>Facturacion automatica y alertas suaves fuera del bloque critico.</p>
              </div>
              <div className="cc-dashboard-console-alertlist cc-bounded-list">
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
                    <span>{getAlertActionLabel(alert)}</span>
                    <strong>{alert.title}</strong>
                    <p>{getAlertImpactCopy(alert)}</p>
                  </button>
                ))}
                {dueRecurringPlans.length === 0 && followUpAlerts.length === 0 ? (
                  <div className="empty-state">
                    <strong>Sin seguimientos de sistema</strong>
                    <p>No hay recurrentes listas ni recordatorios operativos suaves.</p>
                  </div>
                ) : null}
              </div>
            </article>

            <article className="cc-dashboard-console-sidepanel">
              <div className="cc-dashboard-console-sidepanel__header">
                <h3>Lo siguiente</h3>
                <p>Proximos movimientos y colas secundarias sin sacar foco de la vista.</p>
              </div>

              <div className="cc-dashboard-console-footnotes">
                {acceptedWithoutJobView ? (
                  <button type="button" className="cc-dashboard-console-footnote" onClick={() => runQuickView(acceptedWithoutJobView)}>
                    <strong>{acceptedWithoutJobView.label}</strong>
                    <span>{acceptedWithoutJobView.summary}</span>
                  </button>
                ) : null}
                {missingFiscalView ? (
                  <button type="button" className="cc-dashboard-console-footnote" onClick={() => runQuickView(missingFiscalView)}>
                    <strong>{missingFiscalView.label}</strong>
                    <span>{missingFiscalView.summary}</span>
                  </button>
                ) : null}
                {recurringDueView ? (
                  <button type="button" className="cc-dashboard-console-footnote" onClick={() => runQuickView(recurringDueView)}>
                    <strong>{recurringDueView.label}</strong>
                    <span>{recurringDueView.summary}</span>
                  </button>
                ) : null}
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
            </article>
          </div>
        </section>
      </div>
    </section>
  )
}
