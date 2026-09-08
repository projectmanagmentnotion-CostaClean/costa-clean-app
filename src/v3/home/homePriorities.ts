import { getAlertActionLabel } from '../../features/automation/alertPresentation'
import type { AutomationAlertItem } from '../../features/automation/types'
import type { OperationalIncident, OperationalSeverity } from '../../features/dashboard/operationalControl'

export interface V3HomePriority {
  id: string
  severity: Extract<OperationalSeverity, 'critical' | 'warning'>
  label: string
  value: string
  detail: string
  actionLabel: string
  alert?: AutomationAlertItem
  incident?: OperationalIncident
}

function domainForAlert(alert: AutomationAlertItem): string {
  if (alert.ruleId.includes('unpaid_invoices')) return 'unpaid-invoices'
  if (alert.ruleId.includes('completed_jobs_without_invoice')) return 'unbilled-jobs'
  if (alert.ruleId.includes('accepted_quotes_without_job')) return 'accepted-quotes'
  if (alert.ruleId.includes('expenses_')) return 'fiscal-expenses'
  return alert.ruleId
}

function domainForIncident(incident: OperationalIncident): string {
  if (incident.id.startsWith('invoice-')) return 'unpaid-invoices'
  if (incident.id.startsWith('job-without-invoice-')) return 'unbilled-jobs'
  if (incident.id.startsWith('accepted-quote-without-job-')) return 'accepted-quotes'
  if (incident.id.startsWith('client-missing-fiscal-')) return 'client-fiscal'
  if (incident.id.startsWith('property-relation-anomaly-')) return 'property-anomaly'
  return incident.id
}

function formatPriorityValue(count: number, amount?: number): string {
  if (typeof amount === 'number' && amount > 0) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
  }
  return String(count)
}

function severityRank(severity: OperationalSeverity): number {
  return severity === 'critical' ? 0 : 1
}

export function buildV3HomePriorities({ alerts, incidents, limit = 3 }: { alerts: AutomationAlertItem[]; incidents: OperationalIncident[]; limit?: number }): V3HomePriority[] {
  const activeAlerts = alerts
    .filter((alert): alert is AutomationAlertItem & { severity: 'critical' | 'warning' } => alert.count > 0 && (alert.severity === 'critical' || alert.severity === 'warning'))
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.title.localeCompare(right.title, 'es'))
  const alertDomains = new Set(activeAlerts.map(domainForAlert))
  const priorities: V3HomePriority[] = activeAlerts.map((alert) => ({
    id: `alert-${alert.id}`,
    severity: alert.severity,
    label: alert.title,
    value: formatPriorityValue(alert.count, alert.amount),
    detail: alert.summary,
    actionLabel: getAlertActionLabel(alert),
    alert,
  }))

  for (const incident of incidents) {
    if (incident.severity === 'info' || alertDomains.has(domainForIncident(incident))) continue
    priorities.push({
      id: `incident-${incident.id}`,
      severity: incident.severity,
      label: incident.title,
      value: incident.entityLabel,
      detail: incident.summary,
      actionLabel: incident.primaryAction.label,
      incident,
    })
  }

  return priorities
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.label.localeCompare(right.label, 'es') || left.id.localeCompare(right.id))
    .slice(0, limit)
}
