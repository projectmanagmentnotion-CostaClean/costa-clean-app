import { formatCurrency } from '../../app/displayFormat'
import type { DashboardKpiActionId } from '../../features/dashboard/kpiActions'
import type { OperationalIncident, OperationalAction } from '../../features/dashboard/operationalControl'
import type { AutomationAlertItem } from '../../features/automation/types'
import { V3Page, V3PageTitle } from '../components/V3Primitives'
import { buildV3HomePriorities } from './homePriorities'
import { V3HomeHeroKpi } from './V3HomeHeroKpi'
import { V3HomeMetric } from './V3HomeMetric'
import { V3HomePriorityQueue } from './V3HomePriorityQueue'

interface V3HomeMetrics { invoicedThisMonthTotal: number; outstandingReceivablesTotal: number; openQuotesCount: number; completedJobsWithoutInvoiceCount: number }

interface V3HomePageProps { metrics: V3HomeMetrics; alerts: AutomationAlertItem[]; operationalIncidents: OperationalIncident[]; onRunKpiAction: (actionId: DashboardKpiActionId) => void; onOpenAlert: (alert: AutomationAlertItem) => void; onRunOperationalAction: (action: OperationalAction) => void }

export function V3HomePage({ metrics, alerts, operationalIncidents, onRunKpiAction, onOpenAlert, onRunOperationalAction }: V3HomePageProps) {
  const priorities = buildV3HomePriorities({ alerts, incidents: operationalIncidents })
  const secondaryMetrics = [
    metrics.outstandingReceivablesTotal > 0 ? <V3HomeMetric key="outstanding" label="Pendiente de cobro" value={formatCurrency(metrics.outstandingReceivablesTotal)} onOpen={() => onRunKpiAction('outstanding_invoices')} /> : null,
    metrics.openQuotesCount > 0 ? <V3HomeMetric key="open-quotes" label="Presupuestos abiertos" value={String(metrics.openQuotesCount)} onOpen={() => onRunKpiAction('open_quotes')} /> : null,
    metrics.completedJobsWithoutInvoiceCount > 0 ? <V3HomeMetric key="unbilled-jobs" label="Servicios sin facturar" value={String(metrics.completedJobsWithoutInvoiceCount)} onOpen={() => onRunKpiAction('completed_jobs_without_invoice')} /> : null,
  ].filter(Boolean)
  return <V3Page className="v3-home-page"><V3PageTitle eyebrow="Negocio hoy" title="Negocio hoy" description="La lectura ejecutiva de facturación, cobros y próximos asuntos." /><V3HomePriorityQueue priorities={priorities} onOpenAlert={onOpenAlert} onRunIncident={(incident) => onRunOperationalAction(incident.primaryAction)} /><section className="v3-home-overview" aria-labelledby="v3-home-overview-title"><h2 id="v3-home-overview-title">Lectura rápida</h2><V3HomeHeroKpi value={formatCurrency(metrics.invoicedThisMonthTotal)} onOpen={() => onRunKpiAction('invoiced_this_month')} />{secondaryMetrics.length > 0 ? <div className="v3-home-metrics" aria-label="Métricas secundarias">{secondaryMetrics}</div> : null}</section></V3Page>
}
