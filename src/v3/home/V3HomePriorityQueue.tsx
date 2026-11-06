import type { AutomationAlertItem } from '../../features/automation/types'
import type { OperationalIncident } from '../../features/dashboard/operationalControl'
import { V3SecondaryAction, V3Section } from '../components/V3Primitives'
import type { V3HomePriority } from './homePriorities'
import type { DashboardKpiActionId } from '../../features/dashboard/kpiActions'

export function V3HomePriorityQueue({ label = 'Requiere tu atención', priorities, onOpenAlert, onRunIncident, onRunKpiAction, onOpenAll }: { label?: string; priorities: V3HomePriority[]; onOpenAlert: (alert: AutomationAlertItem) => void; onRunIncident: (incident: OperationalIncident) => void; onRunKpiAction: (actionId: DashboardKpiActionId) => void; onOpenAll?: () => void }) {
  return <V3Section label={label} action={onOpenAll ? <V3SecondaryAction onClick={onOpenAll}>Ver todas</V3SecondaryAction> : undefined}>{priorities.length === 0 ? <p className="v3-home-all-clear">Sin asuntos prioritarios ahora.</p> : <div className="v3-home-priority-list">{priorities.map((priority) => <article key={priority.id} className="v3-home-priority"><div><strong>{priority.label}</strong><span>{priority.value}</span><small>{priority.detail}</small></div><V3SecondaryAction onClick={() => priority.kpiAction ? onRunKpiAction(priority.kpiAction) : priority.alert ? onOpenAlert(priority.alert) : priority.incident ? onRunIncident(priority.incident) : undefined}>{priority.actionLabel}</V3SecondaryAction></article>)}</div>}</V3Section>
}
