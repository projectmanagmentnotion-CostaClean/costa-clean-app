import { useMemo, useState } from 'react'
import type { AlertDecision } from '../../features/alerts/alertDecisionApi'
import { getAlertActionLabel, getAlertBucket, getAlertBucketMeta, getAlertImpactCopy, getAlertRoutingLabel, type AlertBucket } from '../../features/automation/alertPresentation'
import type { AutomationAlertItem } from '../../features/automation/types'
import { V3BottomSheet, V3DetailSection, V3EmptyState, V3EntityList, V3EntityListItem, V3EntityStatus, V3Kpi, V3KpiGroup, V3ListWorkspace, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction } from '../components/V3Primitives'
import { useV3ListWindow } from '../components/useV3ListWindow'

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

function decisionFor(alert: AutomationAlertItem, decisions: AlertDecision[]) {
  return decisions.find((decision) => decision.scope === 'global' && decision.alert_key === alert.id && decision.fingerprint === (alert.fingerprint ?? alert.id))
}

function statusFor(alert: AutomationAlertItem, decisions: AlertDecision[]) {
  return decisionFor(alert, decisions)?.status ?? alert.lifecycle ?? 'open'
}

function isReadFor(alert: AutomationAlertItem, decisions: AlertDecision[]) {
  return decisions.some((decision) => decision.scope === 'user' && decision.alert_key === alert.id && decision.fingerprint === (alert.fingerprint ?? alert.id) && Boolean(decision.read_at))
}

function priorityLabel(alert: AutomationAlertItem) {
  return getAlertBucketMeta(getAlertBucket(alert)).label
}

function lifecycleLabel(status: ReturnType<typeof statusFor>, isRead: boolean) {
  if (status === 'acknowledged') return 'Reconocida'
  if (status === 'resolved') return 'Resuelta'
  if (status === 'dismissed') return 'Descartada'
  return isRead ? 'Leída' : 'Pendiente'
}

const priorityOrder: AlertBucket[] = ['critical', 'action', 'follow_up', 'info']

export function V3AlertsPage(props: V3AlertsPageProps) {
  const [filter, setFilter] = useState<AlertFilter>('pending')
  const [selected, setSelected] = useState<AutomationAlertItem | null>(null)
  const states = useMemo(() => props.alerts.map((alert) => ({ alert, status: statusFor(alert, props.decisions), isRead: isReadFor(alert, props.decisions) })), [props.alerts, props.decisions])
  const pending = states.filter(({ status }) => status === 'open' || status === 'acknowledged')
  const critical = pending.filter(({ alert }) => alert.severity === 'critical')
  const reviewed = states.filter(({ status }) => status === 'resolved' || status === 'dismissed')
  const visible = filter === 'pending' ? pending : filter === 'critical' ? critical : filter === 'reviewed' ? reviewed : states
  const listWindow = useV3ListWindow(visible, { resetKey: filter })
  const visiblePage = listWindow.pageItems
  const visibleByPriority = priorityOrder.map((bucket) => ({
    bucket,
    items: visiblePage.filter(({ alert }) => getAlertBucket(alert) === bucket),
  })).filter(({ items }) => items.length > 0)

  function renderAlertRow({ alert, status, isRead }: (typeof states)[number]) {
    const bucket = getAlertBucket(alert)
    const bucketMeta = getAlertBucketMeta(bucket)
    const statusLabel = lifecycleLabel(status, isRead)
    const statusTone = status === 'resolved' ? 'success' : status === 'dismissed' ? 'neutral' : 'warning'

    return <V3EntityListItem key={alert.id} className={`v3-alert-row v3-operational-row v3-alert-row--${bucket}`} ariaLabel={`${alert.title}. ${bucketMeta.label}. ${statusLabel}. ${alert.count} elementos.`} onClick={() => setSelected(alert)}>
      <div className="v3-alert-row__main v3-operational-row__identity">
        <strong>{alert.title}</strong>
        <span>{alert.summary}</span>
        {alert.ageContext || alert.contextLabel ? <small>{[alert.ageContext, alert.contextLabel].filter(Boolean).join(' · ')}</small> : null}
      </div>
      <div className="v3-alert-row__side v3-operational-row__context">
        <div className="v3-operational-statuses">
          <V3EntityStatus context="Prioridad" label={bucketMeta.label} tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'} />
          <V3EntityStatus context="Estado" label={statusLabel} tone={statusTone} />
        </div>
        <strong className="v3-operational-row__value" aria-label={`${alert.count} elementos`}>{alert.count}</strong>
      </div>
    </V3EntityListItem>
  }

  function renderAlertGroup(bucket: AlertBucket, items: (typeof states)) {
    const bucketMeta = getAlertBucketMeta(bucket)
    return <section className="v3-alert-group" key={bucket} aria-labelledby={`v3-alert-group-${bucket}`}>
      <div className="v3-alert-group__header">
        <div>
          <h2 id={`v3-alert-group-${bucket}`}>{bucketMeta.title}</h2>
          <p>{bucketMeta.description}</p>
        </div>
        <span className="v3-alert-group__count">{items.length} {items.length === 1 ? 'alerta' : 'alertas'}</span>
      </div>
      <V3EntityList label={`Alertas: ${bucketMeta.label}`}>{items.map(renderAlertRow)}</V3EntityList>
    </section>
  }

  const selectedStatus = selected ? statusFor(selected, props.decisions) : null
  const selectedRead = selected ? isReadFor(selected, props.decisions) : false

  return <V3Page className="v3-alerts-page">
    <V3PageTitle eyebrow="Centro operativo" title="Alertas" description="Decisiones operativas pendientes, con estado real y trazabilidad." />
    <V3KpiGroup><V3Kpi label="Pendientes" value={String(pending.length)} hint="Abiertas o reconocidas" /><V3Kpi label="Críticas" value={String(critical.length)} hint="Dentro de las pendientes" /><V3Kpi label="Revisadas" value={String(reviewed.length)} hint="Resueltas o descartadas" /></V3KpiGroup>
    <div className="v3-module-controls" role="tablist" aria-label="Filtrar alertas">
      {([['pending', 'Pendientes'], ['critical', 'Críticas'], ['reviewed', 'Revisadas'], ['all', 'Todas']] as const).map(([value, label]) => <V3SecondaryAction key={value} onClick={() => setFilter(value)} ariaPressed={filter === value}>{label}</V3SecondaryAction>)}
    </div>
    {visible.length === 0 ? <V3ListWorkspace label="Alertas" {...listWindow} onPageChange={listWindow.setPage}><V3EmptyState title="Sin alertas en este filtro" description={filter === 'reviewed' ? 'Las alertas resueltas o descartadas aparecerán aquí cuando existan.' : 'No hay decisiones operativas que mostrar ahora.'} /></V3ListWorkspace> : <V3ListWorkspace label="Alertas" {...listWindow} onPageChange={listWindow.setPage}><div className="v3-alert-groups">{visibleByPriority.map(({ bucket, items }) => renderAlertGroup(bucket, items))}</div></V3ListWorkspace>}
    {selected && selectedStatus ? <V3BottomSheet title={selected.title} onClose={() => setSelected(null)}>
      <div className="v3-alert-sheet__status"><V3EntityStatus context="Prioridad" label={priorityLabel(selected)} tone={selected.severity === 'critical' ? 'danger' : selected.severity === 'warning' ? 'warning' : 'neutral'} /><V3EntityStatus context="Estado" label={lifecycleLabel(selectedStatus, selectedRead)} tone={selectedStatus === 'resolved' ? 'success' : selectedStatus === 'dismissed' ? 'neutral' : 'warning'} /></div>
      <V3DetailSection title="Qué requiere atención"><p className="v3-section-copy">{selected.detail}</p><p className="v3-section-copy">{getAlertImpactCopy(selected)}</p>{selected.ageContext ? <p className="v3-section-copy">{selected.ageContext}</p> : null}{selected.contextLabel ? <p className="v3-section-copy">{selected.contextLabel}</p> : null}</V3DetailSection>
      <V3DetailSection title="Contexto operativo"><dl className="v3-alert-facts"><div><dt>Área</dt><dd>{getAlertRoutingLabel(selected)}</dd></div><div><dt>Elementos</dt><dd>{selected.count}</dd></div></dl>{selected.examples?.length ? <div className="v3-alert-examples"><span>Referencias visibles</span>{selected.examples.map((item) => <p key={`${selected.id}-${item}`}>{item}</p>)}</div> : null}</V3DetailSection>
      <div className="v3-workspace-actions v3-alert-sheet__primary"><V3PrimaryAction onClick={() => { props.onMarkRead(selected); props.onOpenAlert(selected); setSelected(null) }}>{getAlertActionLabel(selected)}</V3PrimaryAction></div>
      <div className="v3-alert-sheet__secondary" aria-label="Más acciones"><span>Más acciones</span><div className="v3-workspace-actions"><V3SecondaryAction onClick={() => props.onMarkRead(selected)}>Marcar como leída</V3SecondaryAction>{selectedStatus === 'open' && selected.severity === 'critical' ? <V3SecondaryAction onClick={() => { props.onAcknowledge(selected); setSelected(null) }}>Reconocer</V3SecondaryAction> : null}{selectedStatus === 'open' && selected.severity !== 'critical' ? <V3SecondaryAction onClick={() => { props.onDismiss(selected); setSelected(null) }}>Descartar</V3SecondaryAction> : null}{(selectedStatus === 'resolved' || selectedStatus === 'dismissed') ? <V3SecondaryAction onClick={() => { props.onReopen(selected); setSelected(null) }}>Volver a pendientes</V3SecondaryAction> : null}</div></div>
    </V3BottomSheet> : null}
  </V3Page>
}
