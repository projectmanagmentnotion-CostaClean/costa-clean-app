import type {
  AutomationAlertItem,
  AutomationAlertRouting,
  AutomationAlertRuleId,
} from './types'
import { getAlertActionMeta } from '../alerts/alertActionRegistry'

export type AlertBucket = 'critical' | 'action' | 'follow_up' | 'info'

export interface AlertBucketMeta {
  id: AlertBucket
  label: string
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}

const alertBucketMeta: Record<AlertBucket, AlertBucketMeta> = {
  critical: {
    id: 'critical',
    label: 'Critico',
    title: 'Critico',
    description: 'Bloqueos que afectan cobro, facturacion o control operativo hoy.',
    emptyTitle: 'Sin bloqueos criticos',
    emptyDescription: 'No hay alertas de maxima prioridad activas.',
  },
  action: {
    id: 'action',
    label: 'Accion requerida',
    title: 'Accion requerida',
    description: 'Casos que conviene mover hoy para no acumular trabajo o dinero parado.',
    emptyTitle: 'Sin acciones urgentes',
    emptyDescription: 'No hay alertas prioritarias fuera del bloque critico.',
  },
  follow_up: {
    id: 'follow_up',
    label: 'Seguimiento',
    title: 'Seguimiento',
    description: 'Pendientes utiles para no perder ritmo comercial, recurrente o fiscal.',
    emptyTitle: 'Sin seguimientos pendientes',
    emptyDescription: 'No hay recordatorios relevantes en seguimiento.',
  },
  info: {
    id: 'info',
    label: 'Informativo',
    title: 'Informativo',
    description: 'Avisos de contexto con menor urgencia operativa.',
    emptyTitle: 'Sin avisos informativos',
    emptyDescription: 'No hay avisos suaves fuera del seguimiento activo.',
  },
}

function isFollowUpRule(ruleId: AutomationAlertRuleId): boolean {
  return (
    ruleId === 'public_intake_lead_drafts_pending'
    || ruleId === 'quarter_closing_reminder'
    || ruleId === 'recurring_invoice_plan_due'
  )
}

export function getAlertBucket(alert: AutomationAlertItem): AlertBucket {
  if (alert.severity === 'critical') return 'critical'
  if (alert.severity === 'warning') return 'action'
  if (isFollowUpRule(alert.ruleId)) return 'follow_up'
  return 'info'
}

export function getAlertBucketMeta(bucket: AlertBucket): AlertBucketMeta {
  return alertBucketMeta[bucket]
}

export function groupAlertsByBucket(alerts: AutomationAlertItem[]) {
  return {
    critical: alerts.filter((alert) => getAlertBucket(alert) === 'critical'),
    action: alerts.filter((alert) => getAlertBucket(alert) === 'action'),
    follow_up: alerts.filter((alert) => getAlertBucket(alert) === 'follow_up'),
    info: alerts.filter((alert) => getAlertBucket(alert) === 'info'),
  }
}

function getRoutingActionLabel(routing: AutomationAlertRouting): string {
  if (routing.kind === 'quarterly_closing') return 'Abrir cierre trimestral'
  if (routing.kind === 'view') {
    if (routing.view === 'alerts') return 'Abrir alertas'
    if (routing.view === 'clients') return 'Abrir clientes'
    if (routing.view === 'leads') return 'Abrir solicitudes'
    return 'Abrir vista'
  }

  if (routing.view === 'invoices') return 'Abrir facturas'
  if (routing.view === 'quotes') return 'Abrir presupuestos'
  if (routing.view === 'jobs') return 'Abrir servicios'
  if (routing.view === 'expenses') return 'Abrir gastos'
  if (routing.view === 'payments') return 'Abrir cobros'
  return 'Abrir detalle'
}

export function getAlertActionLabel(alert: AutomationAlertItem): string {
  return getAlertActionMeta(alert).primaryLabel ?? getRoutingActionLabel(alert.routing)
}

export function getAlertImpactCopy(alert: AutomationAlertItem): string {
  if (alert.ruleId === 'unpaid_invoices_older_threshold') {
    return 'Afecta caja y seguimiento de cobro.'
  }

  if (alert.ruleId === 'completed_jobs_without_invoice_older_threshold') {
    return 'Retrasa facturacion de trabajo ya ejecutado.'
  }

  if (alert.ruleId === 'accepted_quotes_without_job_older_threshold') {
    return 'Hay venta aceptada todavia sin activar.'
  }

  if (alert.ruleId === 'expenses_missing_support') {
    return 'Genera huecos documentales antes del cierre.'
  }

  if (alert.ruleId === 'expenses_pending_fiscal_review') {
    return 'Deja revision fiscal abierta antes de consolidar.'
  }

  if (alert.ruleId === 'public_intake_lead_drafts_pending') {
    return 'Puede frenar respuesta comercial o seguimiento inicial.'
  }

  if (alert.ruleId === 'quarter_closing_reminder') {
    return 'Evita cerrar tarde el periodo fiscal pendiente.'
  }

  if (alert.ruleId === 'recurring_invoice_plan_due') {
    return 'Hay emision recurrente lista para convertirse en ingreso.'
  }

  return alert.detail
}
