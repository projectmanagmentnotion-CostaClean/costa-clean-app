import type { AppView } from '../app/navigation'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { OperationalAction, OperationalIncident, OperationalQuickView } from '../features/dashboard/operationalControl'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import { getJobBillingDisplayConcept } from '../features/jobs/jobBilling'
import type { JobListItem } from '../features/jobs/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import { formatCurrency, formatDateEs } from '../app/displayFormat'
import type { AutomationAlertItem } from '../features/automation/types'

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
  onOpenJobWorkspace,
  onOpenView,
  onRunKpiAction,
  alerts,
  operationalIncidents,
  operationalQuickViews,
  onRunOperationalAction,
}: HomePageProps) {
  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const urgentCollectionsCount = metrics.unpaidInvoicesOlderThan7DaysCount + metrics.partiallyPaidInvoicesCount
  const topIncident = operationalIncidents[0] ?? null
  const quickViewById = new Map(operationalQuickViews.map((view) => [view.id, view]))
  const urgentIncidents = operationalIncidents.filter((incident) => incident.severity !== 'info').slice(0, 3)
  const followUpIncidents = operationalIncidents.filter((incident) => incident.severity === 'info').slice(0, 3)
  const todayActionJobs = agenda.todayJobs.slice(0, 3)
  const nextActionJobs = agenda.tomorrowJobs.slice(0, 2)
  const pendingBillingView = quickViewById.get('pending-billing') ?? null
  const pendingCollectionsView = quickViewById.get('pending-collections') ?? null
  const partialCollectionsView = quickViewById.get('partial-collections') ?? null
  const acceptedWithoutJobView = quickViewById.get('quotes-without-conversion') ?? null
  const missingFiscalView = quickViewById.get('clients-missing-fiscal') ?? null
  const overdueInternalView = quickViewById.get('overdue-internal') ?? null
  const fiscalRiskCount = metrics.expensesMissingValidVatInvoiceCount + metrics.fiscalReviewExpensesCount + metrics.fiscalRiskExpensesCount

  const homePrimaryAction = topIncident
    ? {
        eyebrow: topIncident.severity === 'critical' ? 'Bloqueo principal' : 'Prioridad principal',
        label: topIncident.primaryAction.label,
        summary: topIncident.summary,
        detail: topIncident.detail,
        onRun: () => onRunOperationalAction(topIncident.primaryAction),
        secondaryLabel: topIncident.secondaryAction?.label ?? 'Abrir alertas',
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
          summary: `${metrics.completedJobsWithoutInvoiceCount} servicio(s) completados siguen sin factura`,
          detail: 'Conviene cerrar hoy el paso de servicio a factura para no bloquear ingreso.',
          onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
          secondaryLabel: 'Ver trabajo sin facturar',
          onSecondaryRun: () => onRunKpiAction('completed_jobs_without_invoice'),
        }
      : urgentCollectionsCount > 0
        ? {
            eyebrow: 'Prioridad principal',
            label: 'Revisar cobros pendientes',
            summary: `${urgentCollectionsCount} factura(s) requieren seguimiento`,
            detail: 'La operativa esta estable; el siguiente impacto viene de mover cobro y seguimiento.',
            onRun: () => onRunKpiAction('outstanding_invoices'),
            secondaryLabel: 'Abrir cierre fiscal',
            onSecondaryRun: () => onOpenView('fiscal_closing'),
          }
        : {
            eyebrow: 'Prioridad principal',
            label: metrics.outstandingReceivablesTotal > 0 ? 'Ver pendientes de cobro' : 'Nueva factura',
            summary: metrics.outstandingReceivablesTotal > 0
              ? `${formatCurrency(metrics.outstandingReceivablesTotal)} siguen pendientes de cobro`
              : 'No hay bloqueo dominante y la siguiente accion util es avanzar facturacion.',
            detail: metrics.outstandingReceivablesTotal > 0
              ? 'Sin un bloqueo dominante, conviene atacar caja abierta antes de abrir mas frentes.'
              : 'La operativa esta limpia y el mejor siguiente paso es abrir una factura o revisar facturacion del dia.',
            onRun: () => (metrics.outstandingReceivablesTotal > 0 ? onRunKpiAction('outstanding_invoices') : onOpenView('invoices')),
            secondaryLabel: 'Abrir cierre fiscal',
            onSecondaryRun: () => onOpenView('fiscal_closing'),
          }

  const moneyQueue = [
    pendingCollectionsView,
    pendingBillingView,
    acceptedWithoutJobView,
    overdueInternalView,
    partialCollectionsView,
  ].filter(Boolean).slice(0, 4)

  const decisionKpis = [
    {
      label: 'Pendiente de cobro',
      value: formatCurrency(metrics.outstandingReceivablesTotal),
      detail: `${metrics.pendingInvoicesCount} factura(s) siguen abiertas.`,
      badge: urgentCollectionsCount > 0 ? 'Seguimiento' : 'Controlado',
      tone: 'warning',
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      label: 'Trabajo sin facturar',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      detail: 'Servicios ya ejecutados que aun no pasan a factura.',
      badge: metrics.completedJobsWithoutInvoiceOlderThan2DaysCount > 0 ? 'Fuera de plazo' : 'Pendiente',
      tone: 'warning',
      onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
    },
    {
      label: 'Servicios hoy',
      value: String(metrics.jobsScheduledTodayCount),
      detail: metrics.jobsScheduledTodayCount > 0 ? 'Agenda inmediata para ejecutar.' : 'Sin carga operativa para hoy.',
      badge: metrics.jobsScheduledTomorrowCount > 0 ? `Manana ${metrics.jobsScheduledTomorrowCount}` : 'Hoy',
      tone: 'info',
      onRun: () => onRunKpiAction('jobs_today'),
    },
    {
      label: 'Riesgo fiscal o documental',
      value: String(fiscalRiskCount),
      detail: 'Gastos sin soporte, pendientes de revision o con riesgo fiscal.',
      badge: metrics.expensesMissingValidVatInvoiceCount > 0 ? 'Documental' : 'Revision',
      tone: 'warning',
      onRun: () => onOpenView('fiscal_closing'),
    },
  ]

  const primaryQuickActions = [
    {
      title: 'Nueva factura',
      detail: 'Emitir o revisar facturacion.',
      onRun: () => onOpenView('invoices'),
    },
    {
      title: 'Ver pendientes de cobro',
      detail: 'Abrir facturas abiertas del periodo.',
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      title: 'Nuevo presupuesto',
      detail: 'Abrir propuesta comercial.',
      onRun: () => onOpenView('quotes'),
    },
    {
      title: 'Ver trabajo sin facturar',
      detail: 'Ir a servicios completados pendientes.',
      onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
    },
  ]

  const secondaryQuickActions = [
    {
      title: 'Nuevo servicio',
      detail: 'Crear trabajo operativo.',
      onRun: () => onOpenView('jobs'),
    },
    {
      title: 'Nuevo gasto',
      detail: 'Registrar gasto del periodo.',
      onRun: () => onOpenView('expenses'),
    },
    {
      title: 'Revisar cierre fiscal',
      detail: 'Abrir periodo y readiness.',
      onRun: () => onOpenView('fiscal_closing'),
    },
    {
      title: 'Ver gastos por revisar',
      detail: 'Abrir revision fiscal pendiente.',
      onRun: () => onRunKpiAction('expenses_fiscal_requires_review'),
    },
  ]

  const operationalQueue = [
    ...urgentIncidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      detail: incident.summary,
      actionLabel: incident.primaryAction.label,
      onRun: () => onRunOperationalAction(incident.primaryAction),
      tone: incident.severity,
    })),
    ...todayActionJobs.map((job) => ({
      id: job.id,
      title: getJobBillingDisplayConcept(job),
      detail: `${job.client_name ?? job.client_display_code ?? 'Cliente'} · ${formatDateEs(job.scheduled_date)}`,
      actionLabel: 'Abrir servicio',
      onRun: () => onOpenJobWorkspace(job.id),
      tone: 'info' as const,
    })),
  ].slice(0, 5)

  const fiscalReviewItems = [
    {
      label: 'Gastos pendientes de revisar',
      value: String(metrics.fiscalReviewExpensesCount),
      detail: 'Casos marcados para revision fiscal.',
      onRun: () => onRunKpiAction('expenses_fiscal_requires_review'),
    },
    {
      label: 'Gastos sin soporte o IVA valido',
      value: String(metrics.expensesMissingValidVatInvoiceCount),
      detail: 'Soporte documental debil para el periodo.',
      onRun: () => onRunKpiAction('expenses_missing_valid_vat_invoice'),
    },
    {
      label: 'Riesgo fiscal medio o alto',
      value: String(metrics.fiscalRiskExpensesCount),
      detail: 'Registros con riesgo fiscal activo.',
      onRun: () => onRunKpiAction('expenses_fiscal_medium_high_risk'),
    },
    {
      label: 'Preparar cierre',
      value: 'Accion',
      detail: 'Abrir readiness y resumen del periodo.',
      onRun: () => onOpenView('fiscal_closing'),
    },
  ]

  function runQuickView(view: OperationalQuickView | null) {
    if (!view) return
    onRunOperationalAction(view.action)
  }

  return (
    <section className="cc-dashboard-page">
      <header className="cc-dashboard-header cc-dashboard-header--decision">
        <div className="cc-dashboard-header__copy">
          <span className="cc-page-topline__eyebrow">Centro operativo</span>
          <h1 className="cc-page-topline__title">Que hago ahora</h1>
          <p className="cc-page-topline__text">
            Dinero pendiente, trabajo bloqueado, agenda inmediata y revision fiscal/documental en una sola lectura corta.
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
                <h3>Dinero pendiente o bloqueado</h3>
                <p>Una sola lectura para caja abierta, trabajo sin facturar y conversion atascada.</p>
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
                <em className="cc-dashboard-console-kpi__badge">{kpi.badge}</em>
                <strong>{kpi.value}</strong>
                <p>{kpi.detail}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Cola operativa de hoy</h2>
              <p>Maximo cinco items visibles para abrir el siguiente paso sin convertir el Home en una lista larga.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-operating-grid">
            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Accion inmediata</span>
                <h3>Lo que toca mover ahora</h3>
                <p>Trabajo, incidencias y agenda en una sola cola corta.</p>
              </div>

              {operationalQueue.length > 0 ? (
                <div className="cc-dashboard-console-actionlist cc-bounded-list">
                  {operationalQueue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cc-dashboard-console-action cc-dashboard-console-action--${item.tone}`}
                      onClick={item.onRun}
                    >
                      <div className="cc-dashboard-console-action__top">
                        <span>{item.tone === 'critical' ? 'Critico' : item.tone === 'warning' ? 'Accion requerida' : 'Agenda'}</span>
                        <strong>{item.actionLabel}</strong>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Sin cola operativa inmediata</strong>
                  <p>No hay incidencias ni servicios urgentes visibles para hoy.</p>
                </div>
              )}
            </article>

            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Siguiente paso</span>
                <h3>Despues de hoy</h3>
                <p>Lo siguiente que entra cuando cierres el bloque actual.</p>
              </div>

              {nextActionJobs.length > 0 ? (
                <div className="cc-dashboard-console-subqueue">
                  <span className="cc-dashboard-console-subqueue__label">Proximos servicios</span>
                  {nextActionJobs.map((job) => (
                    <button key={job.id} type="button" className="cc-dashboard-console-subqueue__item" onClick={() => onOpenJobWorkspace(job.id)}>
                      <strong>{getJobBillingDisplayConcept(job)}</strong>
                      <span>{formatDateEs(job.scheduled_date)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>Sin siguiente cola inmediata</strong>
                  <p>No hay servicios proximos criticos cargados despues de hoy.</p>
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Acciones rapidas</h2>
              <p>Primero las cuatro acciones dominantes. Debajo, accesos secundarios mas discretos.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-support-grid">
            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Principales</span>
                <h3>Crear o mover ahora</h3>
                <p>Las acciones primarias dominan visualmente porque suelen abrir el siguiente paso real.</p>
              </div>

              <div className="cc-dashboard-console-quickactions">
                {primaryQuickActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    className="cc-dashboard-console-quickaction cc-dashboard-console-quickaction--primary"
                    onClick={action.onRun}
                  >
                    <strong>{action.title}</strong>
                    <span>{action.detail}</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Secundarias</span>
                <h3>Accesos utiles</h3>
                <p>Quedan a mano, pero no compiten con dinero bloqueado ni con la prioridad principal.</p>
              </div>

              <div className="cc-dashboard-console-quickactions">
                {secondaryQuickActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    className="cc-dashboard-console-quickaction"
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
              <h2>Revision fiscal y documental</h2>
              <p>Una banda breve de alerta para decidir si toca revisar gastos o preparar cierre, sin meter el informe completo en Home.</p>
            </div>
          </div>

          <div className="cc-dashboard-console-support-grid">
            <article className="cc-dashboard-console-sidepanel">
              <div className="cc-dashboard-console-sidepanel__header">
                <h3>Riesgo del periodo</h3>
                <p>Lo minimo necesario para detectar si el cierre o el soporte requieren una pasada rapida.</p>
              </div>

              <div className="cc-dashboard-console-alertlist cc-bounded-list">
                {fiscalReviewItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="cc-dashboard-console-alert"
                    onClick={item.onRun}
                  >
                    <span>{item.value}</span>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </button>
                ))}
              </div>
            </article>

            <article className="cc-dashboard-console-sidepanel">
              <div className="cc-dashboard-console-sidepanel__header">
                <h3>Seguimiento corto</h3>
                <p>Contexto auxiliar que conviene tener visible, pero sin robar protagonismo.</p>
              </div>

              <div className="cc-dashboard-console-footnotes">
                {missingFiscalView ? (
                  <button type="button" className="cc-dashboard-console-footnote" onClick={() => runQuickView(missingFiscalView)}>
                    <strong>{missingFiscalView.label}</strong>
                    <span>{missingFiscalView.summary}</span>
                  </button>
                ) : null}
                {acceptedWithoutJobView ? (
                  <button type="button" className="cc-dashboard-console-footnote" onClick={() => runQuickView(acceptedWithoutJobView)}>
                    <strong>{acceptedWithoutJobView.label}</strong>
                    <span>{acceptedWithoutJobView.summary}</span>
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
