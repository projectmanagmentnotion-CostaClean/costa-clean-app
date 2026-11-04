import { useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
import type { AutomationAlertItem } from '../../features/automation/types'
import type { DashboardKpiActionId } from '../../features/dashboard/kpiActions'
import type { OperationalAction, OperationalIncident } from '../../features/dashboard/operationalControl'
import type { ExpenseListItem } from '../../features/expenses/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { V3ActionGroup, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3SecondaryAction, V3Section, V3Select } from '../components/V3Primitives'
import { V3RevenueTrend } from './V3RevenueTrend'
import { buildV3HomePeriodPriorities, buildV3HomePriorities } from './homePriorities'
import { V3HomePriorityQueue } from './V3HomePriorityQueue'
import { buildExecutiveDashboardModel, type DashboardPeriodKind } from './executiveDashboardModel'

interface V3HomePageProps {
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  expenses: ExpenseListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  alerts: AutomationAlertItem[]
  operationalIncidents: OperationalIncident[]
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
  onOpenAlert: (alert: AutomationAlertItem) => void
  onRunOperationalAction: (action: OperationalAction) => void
  onOpenAllAlerts: () => void
}

function currentMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function V3HomePage({ invoices, payments, expenses, jobs, quotes, alerts, operationalIncidents, onRunKpiAction, onOpenAlert, onRunOperationalAction, onOpenAllAlerts }: V3HomePageProps) {
  const now = new Date()
  const monthKey = currentMonthKey(now)
  const [periodKind, setPeriodKind] = useState<DashboardPeriodKind>('month')
  const [periodKey, setPeriodKey] = useState(monthKey)
  const model = buildExecutiveDashboardModel({ invoices, payments, expenses, jobs, quotes }, { kind: periodKind, key: periodKey }, alerts.filter((alert) => alert.count > 0).length)
  const priorities = buildV3HomePriorities({ alerts, incidents: operationalIncidents })
  const periodPriorities = buildV3HomePeriodPriorities({
    periodLabel: model.period.label,
    outstanding: model.outstanding,
    completedUnbilledJobs: model.operational.completedUnbilledJobs,
    expensesWithoutSupport: model.operational.expensesWithoutSupport,
  })
  const canOpenCurrentMonthLists = periodKind === 'month' && periodKey === monthKey
  const format = (value: number) => formatCurrency(value)
  const growthText = (value: number | null) => value === null
    ? 'Sin periodo comparable'
    : `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs periodo anterior`
  const operationalKpis = [
    model.operational.scheduledJobs > 0 ? <V3Kpi key="scheduled" label="Servicios programados" value={String(model.operational.scheduledJobs)} /> : null,
    model.operational.completedJobs > 0 ? <V3Kpi key="completed" label="Servicios completados" value={String(model.operational.completedJobs)} /> : null,
    model.operational.completedUnbilledJobs > 0 ? <V3Kpi key="unbilled" label="Completados sin factura" value={String(model.operational.completedUnbilledJobs)} /> : null,
    model.operational.openQuotes > 0 ? <V3Kpi key="open-quotes" label="Presupuestos abiertos" value={String(model.operational.openQuotes)} /> : null,
    model.operational.acceptedQuotes > 0 ? <V3Kpi key="accepted-quotes" label="Presupuestos aceptados" value={String(model.operational.acceptedQuotes)} /> : null,
    model.operational.expensesWithoutSupport > 0 ? <V3Kpi key="missing-support" label="Gastos sin soporte" value={String(model.operational.expensesWithoutSupport)} /> : null,
    model.operational.alerts > 0 ? <V3Kpi key="alerts" label="Alertas activas" value={String(model.operational.alerts)} onClick={onOpenAllAlerts} /> : null,
  ].filter(Boolean)

  return <V3Page className="v3-home-page">
    <V3PageTitle
      eyebrow="Resumen ejecutivo"
      title="Negocio hoy"
      description="Una lectura real de facturación, cobros, gastos y próximos asuntos."
      action={<V3ActionGroup><V3Select
        aria-label="Periodo del dashboard"
        value={`${periodKind}:${periodKey}`}
        onChange={({ currentTarget }) => {
          const [kind, key] = currentTarget.value.split(':') as [DashboardPeriodKind, string]
          setPeriodKind(kind)
          setPeriodKey(key)
        }}
      >
        <option value={`month:${monthKey}`}>Este mes</option>
        <option value={`quarter:${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`}>Este trimestre</option>
        <option value={`year:${now.getFullYear()}`}>Este año</option>
      </V3Select></V3ActionGroup>}
    />
    <V3HomePriorityQueue label="Estado actual" priorities={priorities} onOpenAlert={onOpenAlert} onRunIncident={(incident) => onRunOperationalAction(incident.primaryAction)} onRunKpiAction={onRunKpiAction} onOpenAll={onOpenAllAlerts} />
    <V3HomePriorityQueue label="Atención del periodo" priorities={periodPriorities} onOpenAlert={onOpenAlert} onRunIncident={(incident) => onRunOperationalAction(incident.primaryAction)} onRunKpiAction={canOpenCurrentMonthLists ? onRunKpiAction : undefined} />
    <div className="v3-home-overview">
      <V3KpiGroup>
        <V3Kpi label="Facturado" value={format(model.invoiced)} hint={growthText(model.growth.invoiced)} onClick={canOpenCurrentMonthLists ? () => onRunKpiAction('invoiced_this_month') : undefined} />
        <V3Kpi label="Cobrado" value={format(model.collected)} hint={`${growthText(model.growth.collected)} · facturas del periodo`} />
        <V3Kpi label="Pendiente de cobro" value={format(model.outstanding)} hint="Facturas emitidas en el periodo" />
        <V3Kpi label="Gastos" value={format(model.expenses)} hint={growthText(model.growth.expenses)} onClick={canOpenCurrentMonthLists ? () => onRunKpiAction('expenses_this_month') : undefined} />
        <V3Kpi label="Resultado estimado" value={format(model.estimatedResult)} hint="Facturado − gastos" />
        <V3Kpi label="IVA estimado" value={format(model.estimatedVat)} hint="Repercutido − soportado elegible" />
      </V3KpiGroup>
      <V3Section label="Evolución del negocio">
        <V3RevenueTrend points={model.trend} />
        <p className="v3-section-copy">Periodo: {model.period.label}. El IVA es una estimación operativa y no sustituye la liquidación oficial.</p>
      </V3Section>
      {operationalKpis.length > 0 ? <V3Section label="Operativa del periodo"><div className="v3-dashboard-operational">{operationalKpis}</div></V3Section> : null}
    </div>
    <V3SecondaryAction onClick={() => onRunKpiAction('invoiced_this_month')}>Ver detalle financiero</V3SecondaryAction>
  </V3Page>
}
