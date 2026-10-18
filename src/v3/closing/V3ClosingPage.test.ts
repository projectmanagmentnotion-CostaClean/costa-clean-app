import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3ClosingPage } from './V3ClosingPage'

function renderClosingPage(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(V3ClosingPage, {
    availableYears: [2026],
    initialSelection: { mode: 'quarter', year: 2026, month: 1, quarter: 1, startDate: '', endDate: '' },
    quarterlySummaryByPeriod: new Map(),
    annualSummaryByYear: new Map(),
    quarterlyClosings: [],
    annualClosings: [],
    invoices: [],
    payments: [],
    expenses: [],
    quotes: [],
    jobs: [],
    clients: [],
    properties: [],
    error: null,
    onNavigateToIncidence: () => undefined,
    onSaveQuarterlyClosing: async () => undefined,
    onSaveAnnualClosing: async () => undefined,
    ...overrides,
  }))
}

describe('V3ClosingPage', () => {
  it('separates calculated values, snapshot state and assistive output', () => {
    const html = renderClosingPage()

    expect(html).toContain('Resumen determinista')
    expect(html).toContain('Datos calculados del periodo activo')
    expect(html).toContain('Estado del periodo y revisión')
    expect(html).toContain('Snapshot interno')
    expect(html).toContain('Salidas del periodo')
    expect(html).toContain('Interpretación asistiva')
    expect(html).toContain('no recalcula importes')
  })

  it('keeps persisted snapshot state separate and never renders its technical id', () => {
    const technicalId = '9f9a0c9d-1234-4db5-9db2-123456789abc'
    const html = renderClosingPage({
      quarterlyClosings: [{
        id: technicalId,
        fiscal_year: 2026,
        fiscal_quarter: 1,
        status: 'prepared',
        closed_at: null,
        notes: 'Revisión interna',
        snapshot_json: null,
      }],
    })

    expect(html).toContain('Snapshot preparado')
    expect(html).not.toContain(technicalId)
  })

  it('does not present an issues snapshot as successful', () => {
    const html = renderClosingPage({
      quarterlyClosings: [{
        id: 'snapshot-with-issues',
        fiscal_year: 2026,
        fiscal_quarter: 1,
        status: 'issues',
        closed_at: null,
        notes: null,
        snapshot_json: null,
      }],
    })

    expect(html).toContain('Snapshot con incidencias')
    expect(html).toContain('<span class="v3-closing-status-item__label">Snapshot</span><span class="v3-status v3-status--warning"><span class="v3-status__label">Snapshot con incidencias</span></span>')
    expect(html).not.toContain('<span class="v3-closing-status-item__label">Snapshot</span><span class="v3-status v3-status--success"><span class="v3-status__label">Snapshot con incidencias</span></span>')
  })

  it('keeps period-specific actions disabled when the period cannot persist a snapshot', () => {
    const html = renderClosingPage({
      initialSelection: { mode: 'month', year: 2026, month: 1, quarter: 1, startDate: '', endDate: '' },
    })

    expect(html).toContain('Selecciona trimestre o año para guardar un snapshot.')
    expect(html).toContain('Generar resumen asistido')
    expect(html).toContain('disabled=""')
  })

  it('uses the shared accessible error state for closing data failures', () => {
    const html = renderClosingPage({ error: 'No se pudo cargar el resumen.' })

    expect(html).toContain('role="alert"')
    expect(html).toContain('No se pudo cargar el cierre')
    expect(html).toContain('No se pudo cargar el resumen.')
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
