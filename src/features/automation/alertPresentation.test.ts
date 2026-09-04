import { describe, expect, it } from 'vitest'
import {
  getAlertActionLabel,
  getAlertBucket,
  groupAlertsByBucket,
} from './alertPresentation'
import type { AutomationAlertItem } from './types'

function buildAlert(overrides: Partial<AutomationAlertItem>): AutomationAlertItem {
  return {
    id: overrides.id ?? 'alert-id',
    ruleId: overrides.ruleId ?? 'quarter_closing_reminder',
    severity: overrides.severity ?? 'info',
    title: overrides.title ?? 'Titulo',
    summary: overrides.summary ?? 'Resumen',
    detail: overrides.detail ?? 'Detalle',
    count: overrides.count ?? 1,
    routing: overrides.routing ?? {
      kind: 'view',
      view: 'alerts',
    },
  }
}

describe('alertPresentation', () => {
  it('maps critical alerts into the critical bucket', () => {
    const alert = buildAlert({
      severity: 'critical',
      ruleId: 'unpaid_invoices_older_threshold',
    })

    expect(getAlertBucket(alert)).toBe('critical')
    expect(getAlertActionLabel(alert)).toBe('Revisar cobros')
  })

  it('maps follow-up rules into the follow_up bucket', () => {
    const alert = buildAlert({
      severity: 'info',
      ruleId: 'public_intake_lead_drafts_pending',
      routing: {
        kind: 'view',
        view: 'leads',
      },
    })

    expect(getAlertBucket(alert)).toBe('follow_up')
    expect(getAlertActionLabel(alert)).toBe('Revisar solicitudes')
  })

  it('groups action-required alerts separately from follow-up alerts', () => {
    const grouped = groupAlertsByBucket([
      buildAlert({
        id: 'warning-alert',
        severity: 'warning',
        ruleId: 'accepted_quotes_without_job_older_threshold',
      }),
      buildAlert({
        id: 'follow-up-alert',
        severity: 'info',
        ruleId: 'quarter_closing_reminder',
      }),
    ])

    expect(grouped.action).toHaveLength(1)
    expect(grouped.follow_up).toHaveLength(1)
    expect(grouped.action[0]?.id).toBe('warning-alert')
    expect(grouped.follow_up[0]?.id).toBe('follow-up-alert')
  })
})
