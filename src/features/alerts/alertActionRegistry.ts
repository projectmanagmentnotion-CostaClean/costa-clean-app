import type { AutomationAlertItem, AutomationAlertRuleId } from '../automation/types'

interface AlertActionMeta {
  primaryLabel: string
  supportsSeen?: boolean
  supportsSnooze?: boolean
  supportsDismiss?: boolean
}

const alertActionMetaByRule: Partial<Record<AutomationAlertRuleId, AlertActionMeta>> = {
  public_intake_lead_drafts_pending: {
    primaryLabel: 'Revisar solicitudes',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: true,
  },
  unpaid_invoices_older_threshold: {
    primaryLabel: 'Abrir cobros urgentes',
    supportsSeen: true,
    supportsSnooze: true,
  },
  completed_jobs_without_invoice_older_threshold: {
    primaryLabel: 'Abrir pendientes de facturar',
    supportsSeen: true,
    supportsSnooze: true,
  },
  accepted_quotes_without_job_older_threshold: {
    primaryLabel: 'Abrir presupuestos aceptados',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: true,
  },
  expenses_missing_support: {
    primaryLabel: 'Abrir gastos sin soporte',
    supportsSeen: true,
    supportsSnooze: true,
  },
  expenses_pending_fiscal_review: {
    primaryLabel: 'Abrir revision fiscal',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: true,
  },
  quarter_closing_reminder: {
    primaryLabel: 'Abrir cierre pendiente',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: true,
  },
  recurring_invoice_plan_due: {
    primaryLabel: 'Abrir recurrentes listas',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: true,
  },
}

export function getAlertActionMeta(alert: AutomationAlertItem): AlertActionMeta {
  return alertActionMetaByRule[alert.ruleId] ?? {
    primaryLabel: 'Abrir alerta',
    supportsSeen: true,
    supportsSnooze: true,
    supportsDismiss: alert.severity !== 'critical',
  }
}

