import type { AppView } from '../app/navigation'
import type { SeverityTone } from '../components/SeverityBadge'
import { DSEmptyState, DSPageHeader } from '../design-system/components'
import { useGsapEntrance } from '../design-system/motion'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { OperationalAction, OperationalIncident, OperationalQuickView } from '../features/dashboard/operationalControl'
import { HomeFiscalKpiGrid, type HomeFiscalKpiItem } from '../features/dashboard/components/HomeFiscalKpiGrid'
import { HomeGsapChartCard } from '../features/dashboard/components/HomeGsapChartCard'
import { HomeQuickActionsPanel } from '../features/dashboard/components/HomeQuickActionsPanel'
import { SvgBarChart } from '../features/dashboard/components/SvgBarChart'
import { SvgLineChart } from '../features/dashboard/components/SvgLineChart'
import { SvgRadialProgress } from '../features/dashboard/components/SvgRadialProgress'
import { HomeMotionSection } from '../features/dashboard/motion/HomeMotionSection'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import { getJobBillingDisplayConcept } from '../features/jobs/jobBilling'
import type { JobListItem } from '../features/jobs/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import '../features/dashboard/home-gsap-dashboard.css'
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

interface HomePrimaryAction {
  primaryKey: string
  secondaryKey: string
  eyebrow: string
  label: string
  summary: string
  detail: string
  onRun: () => void
  secondaryLabel: string
  onSecondaryRun: () => void
}

export function HomePage({
  metrics,
  agenda,
  onOpenJobWorkspace,
  onOpenView,
  onRunKpiAction,
  alerts,
  onOpenAlert,
  operationalIncidents,
  operationalQuickViews,
  onRunOperationalAction,
}: HomePageProps) {
  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const priorityAlerts = alerts
    .filter((alert) => alert.severity === 'critical' || alert.severity === 'warning')
    .slice(0, 3)
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
  const { scopeRef: heroScopeRef } = useGsapEntrance({
    preset: 'fadeUp',
    target: '.cc-dashboard-console-hero--decision',
  })

  const homePrimaryAction: HomePrimaryAction = topIncident
    ? {
        primaryKey: `incident:${topIncident.id}`,
        secondaryKey: topIncident.secondaryAction ? `incident-secondary:${topIncident.id}` : 'alerts',
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
          primaryKey: 'completed-jobs-without-invoice',
          secondaryKey: 'completed-jobs-without-invoice',
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
            primaryKey: 'outstanding-invoices',
            secondaryKey: 'fiscal-closing',
            eyebrow: 'Prioridad principal',
            label: 'Revisar cobros pendientes',
            summary: `${urgentCollectionsCount} factura(s) requieren seguimiento`,
            detail: 'La operativa esta estable; el siguiente impacto viene de mover cobro y seguimiento.',
            onRun: () => onRunKpiAction('outstanding_invoices'),
            secondaryLabel: 'Abrir cierre fiscal',
            onSecondaryRun: () => onOpenView('fiscal_closing'),
          }
        : {
            primaryKey: metrics.outstandingReceivablesTotal > 0 ? 'outstanding-invoices' : 'new-invoice',
            secondaryKey: 'fiscal-closing',
            eyebrow: 'Prioridad principal',
            label: metrics.outstandingReceivablesTotal > 0 ? 'Ver pendientes de cobro' : 'Nueva factura',
            summary: metrics.outstandingReceivablesTotal > 0
              ? `${formatCurrency(metrics.outstandingReceivablesTotal)} siguen pendientes de cobro`
              : 'No hay bloqueo dominante y la siguiente accion util es avanzar facturacion.',
            detail: metrics.outstandingReceivablesTotal > 0
              ? 'Sin un bloqueo dominante, conviene atacar caja abierta antes de abrir mas frentes.'
              : 'La operativa esta limpia y el mejor siguiente paso es abrir una factura o revisar facturacion del dia.',
            onRun: () => (
              metrics.outstandingReceivablesTotal > 0
                ? onRunKpiAction('outstanding_invoices')
                : onOpenView('invoices')
            ),
            secondaryLabel: 'Abrir cierre fiscal',
            onSecondaryRun: () => onOpenView('fiscal_closing'),
          }

  const moneyQueue = [
    pendingCollectionsView,
    pendingBillingView,
    acceptedWithoutJobView,
    overdueInternalView,
    partialCollectionsView,
  ].filter(Boolean).slice(0, 3)

  const fiscalKpis: HomeFiscalKpiItem[] = [
    {
      key: 'pending-collections',
      label: 'Cobro abierto',
      value: formatCurrency(metrics.outstandingReceivablesTotal),
      detail: `${metrics.pendingInvoicesCount} factura(s) abiertas.`,
      badge: urgentCollectionsCount > 0 ? 'Seguimiento' : 'Controlado',
      tone: 'warning' as SeverityTone,
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      key: 'pending-billing',
      label: 'Sin facturar',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      detail: 'Servicios listos para pasar a factura.',
      badge: metrics.completedJobsWithoutInvoiceOlderThan2DaysCount > 0 ? 'Fuera de plazo' : 'Pendiente',
      tone: 'warning' as SeverityTone,
      onRun: () => onRunKpiAction('completed_jobs_without_invoice'),
    },
    {
      key: 'expenses-this-month',
      label: 'Gasto mes',
      value: formatCurrency(metrics.expensesThisMonthTotal),
      detail: metrics.expensesCount > 0 ? 'Gasto registrado en el periodo actual.' : 'Sin gasto este mes.',
      badge: metrics.expensesWithoutReceiptCount > 0 ? `${metrics.expensesWithoutReceiptCount} sin soporte` : 'Con soporte',
      tone: 'info' as SeverityTone,
      onRun: () => onRunKpiAction('expenses_this_month'),
    },
    {
      key: 'fiscal-review-open',
      label: 'Revision fiscal',
      value: String(fiscalRiskCount),
      detail: fiscalRiskCount > 0 ? 'Casos fiscales o documentales pendientes.' : 'Sin frente fiscal dominante.',
      badge: fiscalRiskCount > 0 ? 'Revisar' : 'Estable',
      tone: fiscalRiskCount > 0 ? 'warning' as SeverityTone : 'success' as SeverityTone,
      onRun: () => onRunKpiAction('expenses_fiscal_requires_review'),
    },
  ]

  const compactQuickActions = [
    {
      key: 'new-invoice',
      title: 'Nueva factura',
      detail: 'Emitir.',
      onRun: () => onOpenView('invoices'),
    },
    {
      key: 'outstanding-invoices',
      title: 'Cobros',
      detail: 'Seguir caja.',
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      key: 'new-quote',
      title: 'Presupuesto',
      detail: 'Abrir propuesta.',
      onRun: () => onOpenView('quotes'),
    },
    {
      key: 'new-job',
      title: 'Servicio',
      detail: 'Crear trabajo.',
      onRun: () => onOpenView('jobs'),
    },
    {
      key: 'new-expense',
      title: 'Gasto',
      detail: 'Registrar gasto.',
      onRun: () => onOpenView('expenses'),
    },
    {
      key: 'fiscal-closing',
      title: 'Cierre fiscal',
      detail: 'Revisar periodo.',
      onRun: () => onOpenView('fiscal_closing'),
    },
  ]
    .filter((action) => action.key !== homePrimaryAction.primaryKey && action.key !== homePrimaryAction.secondaryKey)
    .slice(0, 6)

  const immediateLoadSeries = [
    { label: 'Hoy', value: metrics.jobsScheduledTodayCount },
    { label: 'Manana', value: metrics.jobsScheduledTomorrowCount },
    { label: 'Proximos', value: agenda.upcomingJobs.length },
  ]
  const immediateLoadTotal = immediateLoadSeries.reduce((sum, item) => sum + item.value, 0)
  const fiscalReviewSeries = [
    { label: 'Revision', value: metrics.fiscalReviewExpensesCount },
    { label: 'Sin IVA', value: metrics.expensesMissingValidVatInvoiceCount },
    { label: 'Riesgo', value: metrics.fiscalRiskExpensesCount },
  ]
  const documentaryCompletionPercent = metrics.expensesCount > 0
    ? Math.round((metrics.expensesWithReceiptCount / metrics.expensesCount) * 100)
    : 0

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
  ].slice(0, 3)

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
  ]

  function runQuickView(view: OperationalQuickView | null) {
    if (!view) return
    onRunOperationalAction(view.action)
  }

  const supportFootnotes = [
    ...priorityAlerts.map((alert) => ({
      key: `alert:${alert.id}`,
      title: alert.title,
      detail: alert.summary,
      onRun: () => onOpenAlert(alert),
    })),
    ...(missingFiscalView ? [{
      key: `quick-view:${missingFiscalView.id}`,
      title: missingFiscalView.label,
      detail: missingFiscalView.summary,
      onRun: () => runQuickView(missingFiscalView),
    }] : []),
    ...(acceptedWithoutJobView ? [{
      key: `quick-view:${acceptedWithoutJobView.id}`,
      title: acceptedWithoutJobView.label,
      detail: acceptedWithoutJobView.summary,
      onRun: () => runQuickView(acceptedWithoutJobView),
    }] : []),
    ...followUpIncidents.map((incident) => ({
      key: `follow-up:${incident.id}`,
      title: incident.title,
      detail: incident.summary,
      onRun: () => onRunOperationalAction(incident.primaryAction),
    })),
  ].slice(0, 3)

  const shouldShowAlertBand = priorityAlerts.length > 0 || fiscalRiskCount > 0 || supportFootnotes.length > 0

  return (
    <section className="cc-dashboard-page cc-dashboard-page--focus">
      <DSPageHeader
        eyebrow="Centro operativo"
        title="Inicio"
        summary="Una prioridad clara, cola corta y lectura fiscal sin ruido."
        statusLabel={criticalAlertsCount > 0 ? `${criticalAlertsCount} criticas` : 'Operativa estable'}
        statusTone={criticalAlertsCount > 0 ? 'critical' : 'success'}
        metricLabel="Hoy"
        metricValue={`${metrics.jobsScheduledTodayCount} servicio(s)`}
        metricHint={fiscalRiskCount > 0 ? `${fiscalRiskCount} punto(s) de revision.` : 'Sin frente fiscal dominante.'}
      />

      <div className="cc-dashboard-stack cc-dashboard-stack--console cc-dashboard-stack--decision">
        <section className="cc-dashboard-block cc-dashboard-console-hero cc-dashboard-console-hero--decision" ref={heroScopeRef}>
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
                <h3>Caja por mover</h3>
                <p>Tres frentes utiles para desbloquear ingreso.</p>
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
        </section>

        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Acciones y KPIs</h2>
              <p>Accesos utiles y lectura corta del periodo.</p>
            </div>
          </div>

          <div className="cc-home-dashboard-summary-grid">
            <HomeQuickActionsPanel actions={compactQuickActions} />
            <HomeFiscalKpiGrid items={fiscalKpis} />
          </div>
        </HomeMotionSection>

        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Visual fiscal</h2>
              <p>Lectura breve con SVG y motion sobrio.</p>
            </div>
          </div>

          <div className="cc-home-dashboard-chart-grid">
            <HomeGsapChartCard
              eyebrow="Carga inmediata"
              title="Agenda corta"
              value={`${immediateLoadTotal} servicio(s)`}
              description="Hoy, manana y proximos."
              hasData={immediateLoadTotal > 0}
              emptyTitle="Sin agenda inmediata"
              emptyDescription="No hay servicios cargados en la ventana corta de hoy, manana o proximos trabajos."
              actionLabel="Abrir agenda"
              onAction={() => onRunKpiAction('jobs_today')}
            >
              <SvgLineChart data={immediateLoadSeries} />
            </HomeGsapChartCard>

            <HomeGsapChartCard
              eyebrow="Frentes fiscales"
              title="Revision del periodo"
              value={`${fiscalRiskCount} caso(s)`}
              description="Revision, soporte IVA y riesgo."
              hasData={metrics.expensesCount > 0}
              emptyTitle="Sin gasto registrado"
              emptyDescription="Todavia no hay gastos cargados en el periodo para construir la lectura fiscal."
              actionLabel="Abrir revision"
              onAction={() => onRunKpiAction('expenses_fiscal_requires_review')}
            >
              <SvgBarChart data={fiscalReviewSeries} />
            </HomeGsapChartCard>

            <HomeGsapChartCard
              eyebrow="Soporte documental"
              title="Completitud de gastos"
              value={`${metrics.expensesWithReceiptCount}/${metrics.expensesCount}`}
              description="Porcentaje real con soporte."
              hasData={metrics.expensesCount > 0}
              emptyTitle="Sin soporte que revisar"
              emptyDescription="Aun no hay gastos cargados en el periodo para medir completitud documental."
              actionLabel="Abrir gastos"
              onAction={() => onOpenView('expenses')}
            >
              <SvgRadialProgress label="Con soporte" percent={documentaryCompletionPercent} />
            </HomeGsapChartCard>
          </div>
        </HomeMotionSection>

        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>En marcha hoy</h2>
              <p>Solo la siguiente accion real.</p>
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
                <DSEmptyState
                  title="Sin cola operativa inmediata"
                  description="No hay incidencias ni servicios urgentes visibles para hoy."
                />
              )}
            </article>

            <article className="cc-dashboard-console-workpanel">
              <div>
                <span className="cc-dashboard-console-workpanel__eyebrow">Siguiente paso</span>
                <h3>Despues de hoy</h3>
                <p>La siguiente cola inmediata sin abrir otra pantalla larga.</p>
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
                <DSEmptyState
                  title="Sin siguiente cola inmediata"
                  description="No hay servicios proximos criticos cargados despues de hoy."
                />
              )}
            </article>
          </div>
        </HomeMotionSection>

        {shouldShowAlertBand ? (
          <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
            <div className="cc-dashboard-block__header">
              <div>
                <h2>Alertas y revision</h2>
                <p>Solo señales que justifican revisar soporte, alertas o cierre sin abrir el informe completo.</p>
              </div>
            </div>

            <div className="cc-dashboard-console-support-grid">
              <article className="cc-dashboard-console-sidepanel">
                <div className="cc-dashboard-console-sidepanel__header">
                  <h3>Riesgo del periodo</h3>
                  <p>Lectura corta para saber si el cierre o el soporte requieren una pasada rapida.</p>
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
                  <button
                    type="button"
                    className="cc-dashboard-console-alert"
                    onClick={() => onOpenView('fiscal_closing')}
                  >
                    <span>Accion</span>
                    <strong>Preparar cierre</strong>
                    <p>Abrir readiness y resumen del periodo.</p>
                  </button>
                </div>
              </article>

              <article className="cc-dashboard-console-sidepanel">
                <div className="cc-dashboard-console-sidepanel__header">
                  <h3>Seguimiento corto</h3>
                  <p>Alertas importantes y contexto auxiliar sin duplicar la cola operativa principal.</p>
                </div>

                {supportFootnotes.length > 0 ? (
                  <div className="cc-dashboard-console-footnotes">
                    {supportFootnotes.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="cc-dashboard-console-footnote"
                        onClick={item.onRun}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <DSEmptyState
                    title="Sin alertas importantes"
                    description="No hay alertas ni seguimientos auxiliares que necesiten protagonismo ahora mismo."
                  />
                )}
              </article>
            </div>
          </HomeMotionSection>
        ) : null}
      </div>
    </section>
  )
}
