import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3EntityStatus, V3Icon, V3ListWorkspace, V3TabStrip } from './V3Primitives'

describe('V3Icon', () => {
  it('keeps the V3 vector icon set explicit and renders action icons without Unicode glyphs', () => {
    const names = ['alerts', 'back', 'camera', 'chevronDown', 'clients', 'closing', 'expenses', 'forward', 'home', 'invoice', 'jobs', 'leads', 'more', 'payments', 'properties', 'quotes', 'replace', 'trash'] as const
    const html = names.map((name) => renderToStaticMarkup(createElement(V3Icon, { name }))).join('')
    expect(html.match(/<svg/g)?.length).toBe(names.length)
    expect(html).not.toContain('←')
    expect(html).not.toContain('🗑')
  })
})

describe('V3EntityStatus', () => {
  it('keeps an optional operational context visible and accessible without adding a new status value', () => {
    const html = renderToStaticMarkup(createElement(V3EntityStatus, { context: 'Facturación', label: 'Pendiente de cobro', tone: 'warning' }))

    expect(html).toContain('Facturación')
    expect(html).toContain('Pendiente de cobro')
    expect(html).toContain('aria-label="Facturación: Pendiente de cobro"')
  })
})

describe('V3TabStrip', () => {
  it('renders one shared, horizontally navigable tab contract', () => {
    const html = renderToStaticMarkup(createElement(V3TabStrip, {
      label: 'Estado de factura',
      activeValue: 'pending',
      onChange: () => undefined,
      options: [{ value: 'pending', label: 'Pendientes' }, { value: 'paid', label: 'Cobradas' }, { value: 'all', label: 'Todas' }],
    }))

    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Estado de factura"')
    expect((html.match(/role="tab"/g) ?? [])).toHaveLength(3)
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('Pendientes')
    expect(html).toContain('Cobradas')
  })
})

describe('V3ListWorkspace', () => {
  it('exposes a bounded, accessible paginated region with touch-safe controls', () => {
    const html = renderToStaticMarkup(createElement(V3ListWorkspace, {
      label: 'Clientes', totalCount: 1000, page: 1, pageCount: 40, rangeStart: 1, rangeEnd: 25, onPageChange: () => undefined, children: createElement('div', { role: 'list' }, 'rows'),
    }))
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Clientes: resultados"')
    expect(html).toContain('Mostrando 1–25 de 1000')
    expect(html).toContain('Página anterior')
    expect(html).toContain('Página siguiente')
  })
})
