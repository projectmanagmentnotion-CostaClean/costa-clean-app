import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3HomePage } from './V3HomePage'

function renderHome(metrics: { invoicedThisMonthTotal: number; outstandingReceivablesTotal: number; openQuotesCount: number; completedJobsWithoutInvoiceCount: number }) {
  return renderToStaticMarkup(createElement(V3HomePage, {
    metrics,
    alerts: [],
    operationalIncidents: [],
    onRunKpiAction: () => undefined,
    onOpenAlert: () => undefined,
    onRunOperationalAction: () => undefined,
  }))
}

describe('V3HomePage visual density', () => {
  it('omits empty secondary metrics while retaining nonzero operational metrics', () => {
    const html = renderHome({
      invoicedThisMonthTotal: 100,
      outstandingReceivablesTotal: 0,
      openQuotesCount: 2,
      completedJobsWithoutInvoiceCount: 0,
    })

    expect(html).not.toContain('Pendiente de cobro')
    expect(html).toContain('Presupuestos abiertos')
    expect(html).not.toContain('Servicios sin facturar')
  })

  it('omits the secondary metrics block when all values are zero', () => {
    const html = renderHome({
      invoicedThisMonthTotal: 0,
      outstandingReceivablesTotal: 0,
      openQuotesCount: 0,
      completedJobsWithoutInvoiceCount: 0,
    })

    expect(html).not.toContain('Métricas secundarias')
  })
})
