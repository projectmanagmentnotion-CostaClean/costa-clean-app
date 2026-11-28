import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { InvoiceListItem } from '../../features/invoices/types'
import { V3HomePage } from './V3HomePage'

function renderHome(invoices: InvoiceListItem[] = []) {
  return renderToStaticMarkup(createElement(V3HomePage, {
    invoices,
    payments: [],
    expenses: [],
    jobs: [],
    quotes: [],
    alerts: [],
    operationalIncidents: [],
    onRunKpiAction: () => undefined,
    onOpenAlert: () => undefined,
    onRunOperationalAction: () => undefined,
    onOpenAllAlerts: () => undefined,
  }))
}

const invoice: InvoiceListItem = {
  id: 'invoice-september',
  display_code: 'INV-2026-001',
  invoice_number: '2026-001',
  job_id: null,
  client_id: 'synthetic-client',
  issue_date: '2026-09-18',
  status: 'issued',
  subtotal: 100,
  tax_amount: 21,
  total: 121,
}

describe('V3HomePage visual density', () => {
  it('renders executive indicators and omits the operational block when it has no values', () => {
    const html = renderHome([invoice])

    expect(html).toContain('Resumen ejecutivo')
    expect(html).toContain('Facturado')
    expect(html).toContain('Evolución del negocio')
    expect(html).not.toContain('Operativa del periodo')
  })

  it('renders the current period selector and hides empty priority actions', () => {
    const html = renderHome()

    expect(html).toContain('Periodo del dashboard')
    expect(html).toContain('Estado actual')
    expect(html).toContain('Sin asuntos prioritarios ahora.')
    expect(html).not.toContain('Métricas secundarias')
  })

  it('does not route invoice-cohort collections to the payment-date filter', () => {
    const now = new Date()
    const currentMonthInvoice = {
      ...invoice,
      id: 'invoice-current-month',
      issue_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    }
    const html = renderHome([currentMonthInvoice])

    expect(html).toContain('aria-label="Facturado:')
    expect(html).not.toContain('aria-label="Cobrado:')
  })
})
