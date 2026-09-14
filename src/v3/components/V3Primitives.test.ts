import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3Icon } from './V3Primitives'

describe('V3Icon', () => {
  it('keeps the V3 vector icon set explicit and renders action icons without Unicode glyphs', () => {
    const names = ['alerts', 'back', 'camera', 'chevronDown', 'clients', 'closing', 'expenses', 'forward', 'home', 'invoice', 'jobs', 'leads', 'more', 'payments', 'properties', 'quotes', 'replace', 'trash'] as const
    const html = names.map((name) => renderToStaticMarkup(createElement(V3Icon, { name }))).join('')
    expect(html.match(/<svg/g)?.length).toBe(names.length)
    expect(html).not.toContain('←')
    expect(html).not.toContain('🗑')
  })
})
