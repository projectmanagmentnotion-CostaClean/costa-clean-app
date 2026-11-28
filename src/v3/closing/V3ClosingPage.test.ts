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
  it('shows a separate base, VAT and gross breakdown for an issued invoice', () => {
    const html = renderClosingPage({
      invoices: [{
        id: 'synthetic-invoice-001',
        display_code: null,
        invoice_number: null,
        job_id: null,
        client_id: 'synthetic-client-001',
        issue_date: '2026-02-01',
        status: 'issued',
        subtotal: 100,
        tax_amount: 21,
        total: 121,
      }],
    })

    expect(html).toContain('aria-label="Desglose de facturación"')
    expect(html).toContain('Base imponible')
    expect(html).toContain('21,00')
    expect(html).toContain('Total facturado')
  })

  it('renders the T4 fiscal breakdown from emitted invoices only', () => {
    const html = renderClosingPage({
      initialSelection: { mode: 'quarter', year: 2026, month: 10, quarter: 4, startDate: '', endDate: '' },
      invoices: [
        { id: 'issued-1', display_code: null, invoice_number: null, job_id: null, client_id: 'client-1', issue_date: '2026-10-01', status: 'issued', subtotal: 50, tax_amount: 10.5, total: 60.5 },
        { id: 'issued-2', display_code: null, invoice_number: null, job_id: null, client_id: 'client-1', issue_date: '2026-11-01', status: 'paid', subtotal: 40, tax_amount: 8.4, total: 48.4 },
        { id: 'issued-3', display_code: null, invoice_number: null, job_id: null, client_id: 'client-1', issue_date: '2026-12-01', status: 'sent', subtotal: 21, tax_amount: 4.41, total: 25.41 },
        { id: 'draft-1', display_code: null, invoice_number: null, job_id: null, client_id: 'client-1', issue_date: '2026-11-12', status: 'draft', subtotal: 11, tax_amount: 2.31, total: 13.31 },
      ],
      payments: [{ id: 'draft-payment-1', display_code: null, invoice_id: 'draft-1', payment_date: '2026-11-12', amount: 1, payment_method: 'transfer' }],
    })

    expect(html).toContain('111,00')
    expect(html).toContain('23,31')
    expect(html).toContain('134,31')
    expect(html).not.toContain('122,00')
    expect(html).not.toContain('25,62')
    expect(html).not.toContain('147,62')
  })

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

  it('hydrates the internal note from the selected persisted period', () => {
    const html = renderClosingPage({
      quarterlyClosings: [{
        id: 'snapshot-q1',
        fiscal_year: 2026,
        fiscal_quarter: 1,
        status: 'prepared',
        closed_at: null,
        notes: 'Contexto de Q1',
        snapshot_json: null,
      }],
    })

    expect(html).toContain('Contexto de Q1</textarea>')
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
