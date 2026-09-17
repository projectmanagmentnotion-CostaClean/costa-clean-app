import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3EntityStatus, V3Icon } from './V3Primitives'

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
