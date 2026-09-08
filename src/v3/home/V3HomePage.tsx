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
  return <V3Page className="v3-home-page"><V3PageTitle eyebrow="Negocio hoy" title="Negocio hoy" description="La lectura ejecutiva de facturación, cobros y próximos asuntos." /><V3HomeHeroKpi value={formatCurrency(metrics.invoicedThisMonthTotal)} onOpen={() => onRunKpiAction('invoiced_this_month')} /><div className="v3-home-metrics" aria-label="Métricas secundarias"><V3HomeMetric label="Pendiente de cobro" value={formatCurrency(metrics.outstandingReceivablesTotal)} onOpen={() => onRunKpiAction('outstanding_invoices')} /><V3HomeMetric label="Presupuestos abiertos" value={String(metrics.openQuotesCount)} onOpen={() => onRunKpiAction('open_quotes')} /><V3HomeMetric label="Servicios sin facturar" value={String(metrics.completedJobsWithoutInvoiceCount)} onOpen={() => onRunKpiAction('completed_jobs_without_invoice')} /></div><V3HomePriorityQueue priorities={priorities} onOpenAlert={onOpenAlert} onRunIncident={(incident) => onRunOperationalAction(incident.primaryAction)} /></V3Page>
}
