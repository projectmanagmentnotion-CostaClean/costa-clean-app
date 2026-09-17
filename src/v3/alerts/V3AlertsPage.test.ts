import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3AlertsPage } from './V3AlertsPage'

describe('V3AlertsPage', () => {
  it('keeps priority and decision lifecycle distinct in the operational row', () => {
    const html = renderToStaticMarkup(createElement(V3AlertsPage, {
      alerts: [{
        id: 'overdue-invoices',
        ruleId: 'unpaid_invoices_older_threshold',
        severity: 'critical',
        title: 'Facturas pendientes',
        summary: 'Hay facturas que requieren revisión.',
        detail: 'Revisa los cobros pendientes.',
        count: 2,
        routing: { kind: 'module', view: 'invoices', filterKey: 'invoices', filterValue: 'pending' },
      }],
      decisions: [],
      onOpenAlert: () => undefined,
      onMarkRead: () => undefined,
      onAcknowledge: () => undefined,
      onDismiss: () => undefined,
      onReopen: () => undefined,
    }))

    expect(html).toContain('Prioridad')
    expect(html).toContain('Crítica')
    expect(html).toContain('Estado')
    expect(html).toContain('Pendiente')
  })
})
