import { useMemo, useState } from 'react'
import type { AppView } from '../app/navigation'
import { DSPageHeader } from '../design-system/components'
import { HomeAlertSummaryStrip, type HomeAlertSummaryItem } from '../features/dashboard/components/HomeAlertSummaryStrip'
import { HomeFiscalKpiGrid, type HomeFiscalKpiItem } from '../features/dashboard/components/HomeFiscalKpiGrid'
import { HomeQuickActionsPanel, type HomeQuickActionItem } from '../features/dashboard/components/HomeQuickActionsPanel'
import { HomeMotionSection } from '../features/dashboard/motion/HomeMotionSection'
import type { AutomationAlertItem } from '../features/automation/types'
import { getAlertActionMeta } from '../features/alerts/alertActionRegistry'
import { getAlertActionLabel } from '../features/automation/alertPresentation'
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
import { compactVisibleItems, hasMeaningfulAmount, hasMeaningfulCount } from '../shared/ui/visibilityRules'

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
  const { metrics, onOpenView, onRunKpiAction, alerts, onOpenAlert } = props
  const [alertAcknowledgements, setAlertAcknowledgements] = useState(() => readAlertAcknowledgements())

  const criticalAlertsCount = alerts.filter((alert) => alert.severity === 'critical').length
  const fiscalRiskCount = metrics.expensesMissingValidVatInvoiceCount + metrics.fiscalReviewExpensesCount + metrics.fiscalRiskExpensesCount
  const fiscalReviewCount = metrics.expensesMissingValidVatInvoiceCount + metrics.fiscalReviewExpensesCount

  const visiblePriorityAlerts = useMemo(() => (
    alerts
      .filter((alert) => alert.count > 0)
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

  const fiscalKpis: HomeFiscalKpiItem[] = compactVisibleItems<HomeFiscalKpiItem>([
    hasMeaningfulAmount(metrics.invoicedThisMonthTotal) ? {
      key: 'invoiced',
      label: 'Facturado',
      actionLabel: 'Ver facturas',
      value: formatCurrency(metrics.invoicedThisMonthTotal),
      detail: 'Facturas emitidas del mes actual.',
      badge: 'Mes',
      tone: 'info',
      progress: {
        label: 'Cobrado',
        percent: getSafePercent(metrics.collectedThisMonthTotal, Math.max(metrics.invoicedThisMonthTotal, 1)),
        value: formatCurrency(metrics.collectedThisMonthTotal),
      },
      onRun: () => onRunKpiAction('invoiced_this_month'),
    } : null,
    hasMeaningfulAmount(metrics.collectedThisMonthTotal) ? {
      key: 'collected',
      label: 'Cobrado',
      actionLabel: 'Ver cobros',
      value: formatCurrency(metrics.collectedThisMonthTotal),
      detail: 'Cobros registrados del mes actual.',
      badge: 'Mes',
      tone: 'success',
      progress: {
        label: 'Sobre facturado',
        percent: getSafePercent(metrics.collectedThisMonthTotal, Math.max(metrics.invoicedThisMonthTotal, 1)),
        value: `${getSafePercent(metrics.collectedThisMonthTotal, Math.max(metrics.invoicedThisMonthTotal, 1))}%`,
      },
      onRun: () => onRunKpiAction('collected_this_month'),
    } : null,
    hasMeaningfulAmount(metrics.expensesThisMonthTotal) ? {
      key: 'expenses',
      label: 'Gasto',
      actionLabel: 'Ver gastos',
      value: formatCurrency(metrics.expensesThisMonthTotal),
      detail: 'Gastos visibles del mes actual.',
      badge: 'Mes',
      tone: 'info',
      progress: {
        label: 'Con soporte',
        percent: metrics.expensesCount > 0
          ? Math.round((metrics.expensesWithReceiptCount / metrics.expensesCount) * 100)
          : 0,
        value: `${metrics.expensesWithReceiptCount}/${metrics.expensesCount}`,
      },
      onRun: () => onRunKpiAction('expenses_this_month'),
    } : null,
    hasMeaningfulCount(fiscalReviewCount) ? {
      key: 'review',
      label: 'Revision fiscal',
      actionLabel: 'Revisar',
      value: String(fiscalReviewCount),
      detail: fiscalReviewCount > 0 ? 'Gastos con revision o soporte pendiente.' : 'Sin revision pendiente hoy.',
      badge: fiscalReviewCount > 0 ? 'Accion' : 'Limpio',
      tone: fiscalReviewCount > 0 ? 'warning' : 'success',
      progress: {
        label: 'Con riesgo',
        percent: getSafePercent(fiscalRiskCount, Math.max(metrics.expensesCount, 1)),
        value: String(fiscalRiskCount),
      },
      onRun: () => onRunKpiAction('expenses_fiscal_requires_review'),
    } : null,
  ])

  const compactQuickActions: HomeQuickActionItem[] = [
    { key: 'new-invoice', title: 'Factura', onRun: () => onOpenView('invoices') },
    { key: 'payments', title: 'Cobro', onRun: () => onOpenView('payments') },
    { key: 'new-job', title: 'Servicio', onRun: () => onOpenView('jobs') },
    { key: 'new-expense', title: 'Gasto', onRun: () => onOpenView('expenses') },
    { key: 'review-expenses', title: 'Revision', onRun: () => onRunKpiAction('expenses_fiscal_requires_review') },
  ]

  const alertSummaryItems: HomeAlertSummaryItem[] = [
    ...visiblePriorityAlerts.map((alert) => ({
      key: alert.id,
      title: alert.severity === 'critical' ? 'Critica' : 'Pendiente',
      value: `${alert.count}`,
      detail: alert.title,
      primaryActionLabel: getAlertActionLabel(alert),
      tone: (alert.severity === 'critical' ? 'critical' : 'warning') as HomeAlertSummaryItem['tone'],
      onOpen: () => onOpenAlert(alert),
      onSeen: getAlertActionMeta(alert).supportsSeen ? () => acknowledgeAlert(alert, 'seen') : undefined,
      onSnooze: getAlertActionMeta(alert).supportsSnooze ? () => acknowledgeAlert(alert, 'snoozed') : undefined,
      onDismiss: getAlertActionMeta(alert).supportsDismiss ? () => acknowledgeAlert(alert, 'dismissed') : undefined,
    })),
    ...(visiblePriorityAlerts.length < 3 && metrics.completedJobsWithoutInvoiceCount > 0 ? [{
      key: 'unbilled-jobs',
      title: 'Facturar',
      value: `${metrics.completedJobsWithoutInvoiceCount}`,
      detail: 'Servicios listos para factura.',
      primaryActionLabel: 'Facturar servicios',
      tone: 'warning' as const,
      onOpen: () => onRunKpiAction('completed_jobs_without_invoice'),
    }] : []),
    ...(visiblePriorityAlerts.length < 2 && fiscalReviewCount > 0 ? [{
      key: 'fiscal-review',
      title: 'Revision',
      value: `${fiscalReviewCount}`,
      detail: 'Gastos pendientes de revision o soporte.',
      primaryActionLabel: 'Abrir revision fiscal',
      tone: 'warning' as const,
      onOpen: () => onRunKpiAction('expenses_fiscal_requires_review'),
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
        summary="Acciones, importes del mes y alertas vivas."
        statusLabel={homeStatus}
        statusTone={criticalAlertsCount > 0 ? 'critical' : fiscalRiskCount > 0 ? 'warning' : 'success'}
        primaryAction={{
          label: 'Clientes',
          onClick: () => onOpenView('clients'),
        }}
        secondaryAction={{
          label: 'Facturas',
          onClick: () => onOpenView('invoices'),
        }}
      metricLabel={hasMeaningfulAmount(metrics.outstandingReceivablesTotal) ? 'Abierto' : undefined}
      metricValue={hasMeaningfulAmount(metrics.outstandingReceivablesTotal) ? formatCurrency(metrics.outstandingReceivablesTotal) : undefined}
      metricHint={hasMeaningfulAmount(metrics.outstandingReceivablesTotal) ? 'Pendiente real de cobro.' : undefined}
    />

      <div className="cc-dashboard-stack cc-dashboard-stack--console cc-dashboard-stack--decision">
        <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
          <div className="cc-home-dashboard-cockpit-grid">
            {fiscalKpis.length > 0 ? <HomeFiscalKpiGrid items={fiscalKpis} /> : null}
            <HomeQuickActionsPanel actions={compactQuickActions} />
          </div>
        </HomeMotionSection>

        {alertSummaryItems.length > 0 ? (
          <HomeMotionSection className="cc-dashboard-block cc-dashboard-console-section">
            <HomeAlertSummaryStrip items={alertSummaryItems} />
          </HomeMotionSection>
        ) : null}
      </div>
    </section>
  )
}
