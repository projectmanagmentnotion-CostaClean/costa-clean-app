import { useMemo, useState } from 'react'
import type { AlertDecision } from '../../features/alerts/alertDecisionApi'
import { getAlertActionLabel } from '../../features/automation/alertPresentation'
import type { AutomationAlertItem } from '../../features/automation/types'
import { V3BottomSheet, V3DetailSection, V3EmptyState, V3EntityList, V3EntityListItem, V3EntityStatus, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction } from '../components/V3Primitives'

interface V3AlertsPageProps {
  alerts: AutomationAlertItem[]
  decisions: AlertDecision[]
  onOpenAlert: (alert: AutomationAlertItem) => void
  onMarkRead: (alert: AutomationAlertItem) => void
  onAcknowledge: (alert: AutomationAlertItem) => void
  onDismiss: (alert: AutomationAlertItem) => void
  onReopen: (alert: AutomationAlertItem) => void
}

type AlertFilter = 'pending' | 'critical' | 'reviewed' | 'all'

function statusFor(alert: AutomationAlertItem, decisions: AlertDecision[]) {
  return decisions.find((decision) => decision.scope === 'global' && decision.alert_key === alert.id && decision.fingerprint === (alert.fingerprint ?? alert.id))?.status ?? alert.lifecycle ?? 'open'
}

export function V3AlertsPage(props: V3AlertsPageProps) {
  const [filter, setFilter] = useState<AlertFilter>('pending')
  const [selected, setSelected] = useState<AutomationAlertItem | null>(null)
  const states = useMemo(() => props.alerts.map((alert) => ({ alert, status: statusFor(alert, props.decisions) })), [props.alerts, props.decisions])
  const pending = states.filter(({ status }) => status === 'open' || status === 'acknowledged')
  const critical = pending.filter(({ alert }) => alert.severity === 'critical')
  const reviewed = states.filter(({ status }) => status === 'resolved' || status === 'dismissed')
  const visible = (filter === 'pending' ? pending : filter === 'critical' ? critical : filter === 'reviewed' ? reviewed : states)

  return <V3Page className="v3-alerts-page">
    <V3PageTitle eyebrow="Centro operativo" title="Alertas" description="Decisiones operativas pendientes, con estado real y trazabilidad." />
    <V3KpiGroup><V3Kpi label="Pendientes" value={String(pending.length)} hint="Abiertas o reconocidas" /><V3Kpi label="Críticas" value={String(critical.length)} hint="Dentro de las pendientes" /></V3KpiGroup>
    <div className="v3-module-controls" role="tablist" aria-label="Filtrar alertas">
      {([['pending', 'Pendientes'], ['critical', 'Críticas'], ['reviewed', 'Revisadas'], ['all', 'Todas']] as const).map(([value, label]) => <V3SecondaryAction key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</V3SecondaryAction>)}
    </div>
    {visible.length === 0 ? <V3EmptyState title="Sin alertas en este filtro" description="No hay decisiones operativas que mostrar ahora." /> : <V3EntityList label="Alertas">
      {visible.map(({ alert, status }) => <V3EntityListItem key={alert.id} ariaLabel={alert.title} onClick={() => setSelected(alert)}>
        <div className="v3-alert-row__main"><V3EntityStatus label={alert.severity === 'critical' ? 'Crítica' : alert.severity === 'warning' ? 'Prioritaria' : 'Informativa'} tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'} /><strong>{alert.title}</strong><span>{alert.summary}</span></div>
        <div className="v3-alert-row__side"><strong>{alert.count}</strong><small>{status === 'acknowledged' ? 'Reconocida' : status === 'resolved' ? 'Resuelta' : status === 'dismissed' ? 'Descartada' : 'Pendiente'}</small></div>
      </V3EntityListItem>)}
    </V3EntityList>}
    {selected ? <V3BottomSheet title={selected.title} onClose={() => setSelected(null)}>
      <V3DetailSection title="Contexto"><p className="v3-section-copy">{selected.detail}</p>{selected.ageContext ? <p className="v3-section-copy">{selected.ageContext}</p> : null}{selected.contextLabel ? <p className="v3-section-copy">{selected.contextLabel}</p> : null}</V3DetailSection>
      <div className="v3-workspace-actions"><V3PrimaryAction onClick={() => { props.onMarkRead(selected); props.onOpenAlert(selected); setSelected(null) }}>{getAlertActionLabel(selected)}</V3PrimaryAction><V3SecondaryAction onClick={() => props.onMarkRead(selected)}>Marcar como leída</V3SecondaryAction>{statusFor(selected, props.decisions) === 'open' && selected.severity === 'critical' ? <V3SecondaryAction onClick={() => { props.onAcknowledge(selected); setSelected(null) }}>Reconocer</V3SecondaryAction> : null}{statusFor(selected, props.decisions) === 'open' && selected.severity !== 'critical' ? <V3SecondaryAction onClick={() => { props.onDismiss(selected); setSelected(null) }}>Descartar</V3SecondaryAction> : null}{(statusFor(selected, props.decisions) === 'resolved' || statusFor(selected, props.decisions) === 'dismissed') ? <V3SecondaryAction onClick={() => { props.onReopen(selected); setSelected(null) }}>Volver a pendientes</V3SecondaryAction> : null}</div>
    </V3BottomSheet> : null}
  </V3Page>
}
