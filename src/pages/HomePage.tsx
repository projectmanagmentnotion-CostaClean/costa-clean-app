import { useMemo, useState } from 'react'
import type { AppView } from '../app/navigation'
import { DSEmptyState, DSPageHeader } from '../design-system/components'
import { HomeAlertSummaryStrip, type HomeAlertSummaryItem } from '../features/dashboard/components/HomeAlertSummaryStrip'
import { HomeFiscalKpiGrid, type HomeFiscalKpiItem } from '../features/dashboard/components/HomeFiscalKpiGrid'
import { HomeGsapChartCard } from '../features/dashboard/components/HomeGsapChartCard'
import { HomePeriodSelector, type HomePeriodOption } from '../features/dashboard/components/HomePeriodSelector'
import { HomeQuickActionsPanel, type HomeQuickActionItem } from '../features/dashboard/components/HomeQuickActionsPanel'
import { SvgBarChart } from '../features/dashboard/components/SvgBarChart'
import { SvgLineChart } from '../features/dashboard/components/SvgLineChart'
import { SvgRadialProgress } from '../features/dashboard/components/SvgRadialProgress'
import { HomeMotionSection } from '../features/dashboard/motion/HomeMotionSection'
import type { AutomationAlertItem } from '../features/automation/types'
import {
  createTomorrowIsoReference,
  getAlertAcknowledgementKey,
  isAlertSuppressedInHome,
  readAlertAcknowledgements,
  upsertAlertAcknowledgement,
} from '../features/alerts/alertAcknowledgements'
import type { ClientWorkspaceTab } from '../features/clients/useClientWorkspaceNavigation'
import type { OperationalAction, OperationalIncident, OperationalQuickView } from '../features/dashboard/operationalControl'
import type { DashboardKpiActionId } from '../features/dashboard/kpiActions'
import type { JobListItem } from '../features/jobs/types'
import type { RecurringInvoicePlanListItem } from '../features/recurringInvoices/types'
import '../features/dashboard/home-gsap-dashboard.css'
import { formatCurrency } from '../app/displayFormat'

type ValuePeriod = 'month' | 'quarter' | 'total' | 'current'

const monthTotalOptions: HomePeriodOption[] = [
  { key: 'month', label: 'Mes' },
  { key: 'total', label: 'Total' },
]

const monthQuarterOptions: HomePeriodOption[] = [
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trim' },
]

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

function getSafePercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)))
}

export function HomePage(props: HomePageProps) {
  const { metrics, agenda, onOpenView, onRunKpiAction, alerts, onOpenAlert } = props
  const [invoicedPeriod, setInvoicedPeriod] = useState<ValuePeriod>('month')
  const [collectedPeriod, setCollectedPeriod] = useState<ValuePeriod>('month')
  const [expensesPeriod, setExpensesPeriod] = useState<ValuePeriod>('month')
  const [cashChartPeriod, setCashChartPeriod] = useState<ValuePeriod>('month')
  const [alertAcknowledgements, setAlertAcknowledgements] = useState(() => readAlertAcknowledgements())

  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const fiscalRiskCount = metrics.expensesMissingValidVatInvoiceCount + metrics.fiscalReviewExpensesCount + metrics.fiscalRiskExpensesCount
  const documentaryCompletionPercent = metrics.expensesCount > 0
    ? Math.round((metrics.expensesWithReceiptCount / metrics.expensesCount) * 100)
    : 0

  const visiblePriorityAlerts = useMemo(() => (
    alerts
      .filter((alert) => alert.severity === 'critical' || alert.severity === 'warning')
      .filter((alert) => !isAlertSuppressedInHome(alert, alertAcknowledgements[getAlertAcknowledgementKey(alert)]))
      .slice(0, 2)
  ), [alertAcknowledgements, alerts])

  function acknowledgeAlert(alert: AutomationAlertItem, status: 'seen' | 'snoozed' | 'dismissed') {
    const alertKey = getAlertAcknowledgementKey(alert)
    setAlertAcknowledgements((current) => upsertAlertAcknowledgement(
      current,
      alertKey,
      status,
      status === 'snoozed' ? { snoozeUntil: createTomorrowIsoReference() } : undefined,
    ))
  }

  const invoicedValue = invoicedPeriod === 'total' ? metrics.totalInvoiced : metrics.invoicedThisMonthTotal
  const collectedValue = collectedPeriod === 'total' ? metrics.totalCollected : metrics.collectedThisMonthTotal
  const expenseValue = expensesPeriod === 'quarter' ? metrics.expensesThisQuarterTotal : metrics.expensesThisMonthTotal
  const invoicedProgressPercent = getSafePercent(
    invoicedPeriod === 'total' ? metrics.totalCollected : metrics.collectedThisMonthTotal,
    Math.max(invoicedValue, 1),
  )
  const collectedProgressPercent = getSafePercent(
    collectedValue,
    Math.max(invoicedPeriod === 'total' ? metrics.totalInvoiced : metrics.invoicedThisMonthTotal, 1),
  )
  const expenseSupportPercent = documentaryCompletionPercent
  const reviewCoveragePercent = getSafePercent(fiscalRiskCount, Math.max(metrics.expensesCount, 1))

  const fiscalKpis: HomeFiscalKpiItem[] = [
    {
      key: 'invoiced',
      label: 'Facturado',
      value: formatCurrency(invoicedValue),
      detail: invoicedPeriod === 'total' ? 'Acumulado seguro.' : 'Mes actual.',
      badge: invoicedPeriod === 'total' ? 'Total' : 'Mes',
      tone: 'info',
      periodOptions: monthTotalOptions,
      periodValue: invoicedPeriod,
      onPeriodChange: (nextValue) => setInvoicedPeriod(nextValue as ValuePeriod),
      progress: {
        label: 'Cobrado',
        percent: invoicedProgressPercent,
        value: formatCurrency(invoicedPeriod === 'total' ? metrics.totalCollected : metrics.collectedThisMonthTotal),
      },
      onRun: () => onOpenView('invoices'),
    },
    {
      key: 'collected',
      label: 'Cobrado',
      value: formatCurrency(collectedValue),
      detail: collectedPeriod === 'total' ? 'Caja acumulada.' : 'Cobro del mes.',
      badge: collectedPeriod === 'total' ? 'Total' : 'Mes',
      tone: 'success',
      periodOptions: monthTotalOptions,
      periodValue: collectedPeriod,
      onPeriodChange: (nextValue) => setCollectedPeriod(nextValue as ValuePeriod),
      progress: {
        label: 'Sobre facturado',
        percent: collectedProgressPercent,
        value: `${collectedProgressPercent}%`,
      },
      onRun: () => onRunKpiAction('outstanding_invoices'),
    },
    {
      key: 'expenses',
      label: 'Gasto',
      value: formatCurrency(expenseValue),
      detail: expensesPeriod === 'quarter' ? 'Trimestre activo.' : 'Mes actual.',
      badge: expensesPeriod === 'quarter' ? 'Trim' : 'Mes',
      tone: 'info',
      periodOptions: monthQuarterOptions,
      periodValue: expensesPeriod,
      onPeriodChange: (nextValue) => setExpensesPeriod(nextValue as ValuePeriod),
      progress: {
        label: 'Con soporte',
        percent: expenseSupportPercent,
        value: `${metrics.expensesWithReceiptCount}/${metrics.expensesCount}`,
      },
      onRun: () => onOpenView('expenses'),
    },
    {
      key: 'review',
      label: 'Revisar',
      value: String(fiscalRiskCount),
      detail: fiscalRiskCount > 0 ? 'Frentes fiscales activos.' : 'Sin frente dominante.',
      badge: fiscalRiskCount > 0 ? 'Riesgo' : 'Estable',
      tone: fiscalRiskCount > 0 ? 'warning' : 'success',
      progress: {
        label: 'Sobre gastos',
        percent: reviewCoveragePercent,
        value: `${reviewCoveragePercent}%`,
      },
      onRun: () => onOpenView('fiscal_closing'),
    },
  ]

  const compactQuickActions: HomeQuickActionItem[] = [
    { key: 'new-invoice', title: 'Factura', onRun: () => onOpenView('invoices') },
    { key: 'new-quote', title: 'Presupuesto', onRun: () => onOpenView('quotes') },
    { key: 'new-job', title: 'Servicio', onRun: () => onOpenView('jobs') },
    { key: 'new-expense', title: 'Gasto', onRun: () => onOpenView('expenses') },
    { key: 'outstanding-invoices', title: 'Cobros', onRun: () => onRunKpiAction('outstanding_invoices') },
    { key: 'fiscal-closing', title: 'Cierre', onRun: () => onOpenView('fiscal_closing') },
  ]

  const cashChartSeries = cashChartPeriod === 'total'
    ? [
        { label: 'Fact.', value: Math.round(metrics.totalInvoiced) },
        { label: 'Cob.', value: Math.round(metrics.totalCollected) },
        { label: 'Abierto', value: Math.round(metrics.outstandingReceivablesTotal) },
      ]
    : [
        { label: 'Fact.', value: Math.round(metrics.invoicedThisMonthTotal) },
        { label: 'Cob.', value: Math.round(metrics.collectedThisMonthTotal) },
        { label: 'Abierto', value: Math.round(Math.max(metrics.invoicedThisMonthTotal - metrics.collectedThisMonthTotal, 0)) },
      ]

  const agendaSeries = [
    { label: 'Hoy', value: metrics.jobsScheduledTodayCount },
    { label: 'Man.', value: metrics.jobsScheduledTomorrowCount },
    { label: 'Prox.', value: agenda.upcomingJobs.length },
  ]

  const fiscalReviewSeries = [
    { label: 'Rev.', value: metrics.fiscalReviewExpensesCount },
    { label: 'IVA', value: metrics.expensesMissingValidVatInvoiceCount },
    { label: 'Risk', value: metrics.fiscalRiskExpensesCount },
  ]

  const alertSummaryItems: HomeAlertSummaryItem[] = [
    ...visiblePriorityAlerts.map((alert) => ({
      key: alert.id,
      title: alert.severity === 'critical' ? 'Critica' : 'Pendiente',
      value: `${alert.count}`,
      detail: alert.title,
      tone: (alert.severity === 'critical' ? 'critical' : 'warning') as HomeAlertSummaryItem['tone'],
      onOpen: () => onOpenAlert(alert),
      onSeen: () => acknowledgeAlert(alert, 'seen'),
      onSnooze: () => acknowledgeAlert(alert, 'snoozed'),
      onDismiss: alert.severity === 'critical' ? undefined : () => acknowledgeAlert(alert, 'dismissed'),
    })),
    ...(visiblePriorityAlerts.length < 3 && metrics.completedJobsWithoutInvoiceCount > 0 ? [{
      key: 'unbilled-jobs',
      title: 'Facturar',
      value: `${metrics.completedJobsWithoutInvoiceCount}`,
      detail: 'Servicios listos para factura.',
      tone: 'warning' as const,
      onOpen: () => onRunKpiAction('completed_jobs_without_invoice'),
    }] : []),
    ...(visiblePriorityAlerts.length < 2 && fiscalRiskCount > 0 ? [{
      key: 'fiscal-risk',
      title: 'Revisar',
      value: `${fiscalRiskCount}`,
      detail: 'Fiscal o soporte pendiente.',
      tone: 'warning' as const,
      onOpen: () => onOpenView('fiscal_closing'),
    }] : []),
  ].slice(0, 3)

  const homeStatus = criticalAlertsCount > 0
    ? `${criticalAlertsCount} criticas`
    : fiscalRiskCount > 0
      ? 'Revision abierta'
      : 'Operativa estable'

  return (
    <section className="cc-dashboard-page cc-dashboard-page--focus">
      <DSPageHeader
        eyebrow="Cockpit"
        title="Inicio"
        summary="KPIs, visual fiscal y accesos directos."
        statusLabel={homeStatus}
        statusTone={criticalAlertsCount > 0 ? 'critical' : fiscalRiskCount > 0 ? 'warning' : 'success'}
        metricLabel="Abierto"
        metricValue={formatCurrency(metrics.outstandingReceivablesTotal)}
        metricHint="Pendiente real de cobro."
      >
        <HomePeriodSelector
          compact
          ariaLabel="Periodo visual de home"
          options={monthQuarterOptions}
          value={expensesPeriod}
          onChange={(nextValue) => setExpensesPeriod(nextValue as ValuePeriod)}
        />
      </DSPageHeader>

      <div className="cc-dashboard-stack cc-dashboard-stack--console cc-dashboard-stack--decision">
        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-home-dashboard-cockpit-grid">
            <HomeFiscalKpiGrid items={fiscalKpis} />
            <HomeQuickActionsPanel actions={compactQuickActions} />
          </div>
        </HomeMotionSection>

        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-dashboard-block__header">
            <div>
              <h2>Visual</h2>
              <p>Solo lecturas cortas y reales.</p>
            </div>
          </div>

          <div className="cc-home-dashboard-chart-grid">
            <HomeGsapChartCard
              eyebrow="Caja"
              title="Facturado vs cobrado"
              value={cashChartPeriod === 'total' ? formatCurrency(metrics.totalCollected) : formatCurrency(metrics.collectedThisMonthTotal)}
              description="Facturado, cobrado y abierto."
              hasData={cashChartSeries.some((item) => item.value > 0)}
              emptyTitle="Sin caja para mostrar"
              emptyDescription="Todavia no hay importes suficientes para esta lectura."
              actionLabel="Abrir facturas"
              onAction={() => onOpenView('invoices')}
              periodOptions={monthTotalOptions}
              periodValue={cashChartPeriod}
              onPeriodChange={(nextValue) => setCashChartPeriod(nextValue as ValuePeriod)}
            >
              <SvgBarChart data={cashChartSeries} />
            </HomeGsapChartCard>

            <HomeGsapChartCard
              eyebrow="Agenda"
              title="Carga inmediata"
              value={`${agendaSeries.reduce((sum, item) => sum + item.value, 0)} servicio(s)`}
              description="Hoy, manana y proximos."
              hasData={agendaSeries.some((item) => item.value > 0)}
              emptyTitle="Sin agenda inmediata"
              emptyDescription="No hay servicios visibles en la ventana corta."
              actionLabel="Abrir servicios"
              onAction={() => onOpenView('jobs')}
            >
              <SvgLineChart data={agendaSeries} />
            </HomeGsapChartCard>

            <HomeGsapChartCard
              eyebrow="Soporte"
              title="Revision y soporte"
              value={`${documentaryCompletionPercent}%`}
              description="Revision, IVA y soporte."
              hasData={metrics.expensesCount > 0}
              emptyTitle="Sin soporte que revisar"
              emptyDescription="Aun no hay gasto suficiente para esta lectura."
              actionLabel="Abrir cierre"
              onAction={() => onOpenView('fiscal_closing')}
            >
              {fiscalRiskCount > 0 ? (
                <SvgBarChart data={fiscalReviewSeries} />
              ) : (
                <SvgRadialProgress label="Con soporte" percent={documentaryCompletionPercent} />
              )}
            </HomeGsapChartCard>
          </div>
        </HomeMotionSection>

        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          {alertSummaryItems.length > 0 ? (
            <HomeAlertSummaryStrip items={alertSummaryItems} />
          ) : (
            <DSEmptyState
              title="Sin alertas repetidas en inicio"
              description="Los detalles siguen disponibles dentro de sus modulos."
            />
          )}
        </HomeMotionSection>
      </div>
    </section>
  )
}
