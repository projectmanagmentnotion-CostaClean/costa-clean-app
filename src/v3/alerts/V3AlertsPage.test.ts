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
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
  })

  it('renders an actionable empty state when the selected lifecycle filter has no records', () => {
    const html = renderToStaticMarkup(createElement(V3AlertsPage, {
      alerts: [],
      decisions: [],
      onOpenAlert: () => undefined,
      onMarkRead: () => undefined,
      onAcknowledge: () => undefined,
      onDismiss: () => undefined,
      onReopen: () => undefined,
    }))

    expect(html).toContain('Sin alertas en este filtro')
    expect(html).toContain('No hay decisiones operativas que mostrar ahora.')
    expect(html).toContain('Revisadas')
  })

  it('does not render technical identifiers in the accessible alert row', () => {
    const technicalId = '9f9a0c9d-1234-4db5-9db2-123456789abc'
    const html = renderToStaticMarkup(createElement(V3AlertsPage, {
      alerts: [{
        id: technicalId,
        ruleId: 'quarter_closing_reminder',
        severity: 'info',
        title: 'Cierre pendiente',
        summary: 'Revisa el periodo anterior.',
        detail: 'El periodo requiere preparación.',
        count: 1,
        contextLabel: 'Periodo pendiente: T2 2026.',
        routing: { kind: 'quarterly_closing', fiscalYear: 2026, fiscalQuarter: 2 },
      }],
      decisions: [],
      onOpenAlert: () => undefined,
      onMarkRead: () => undefined,
      onAcknowledge: () => undefined,
      onDismiss: () => undefined,
      onReopen: () => undefined,
    }))

    expect(html).toContain('Cierre pendiente')
    expect(html).not.toContain(technicalId)
  })
})
