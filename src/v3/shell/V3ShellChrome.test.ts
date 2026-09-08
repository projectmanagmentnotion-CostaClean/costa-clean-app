import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3ShellChrome } from './V3ShellChrome'

describe('V3 dedicated shell', () => {
  it('renders the primary navigation and More entry without the legacy shell tree', () => {
    const html = renderToStaticMarkup(createElement(V3ShellChrome, {
      currentView: 'invoices',
      onChangeView: () => {},
      onBack: () => {},
      backTargetView: 'dashboard',
      accountLabel: 'QA',
      isSigningOut: false,
      onSignOut: async () => {},
    }))

    expect(html).toContain('CostaClean')
    expect(html).toContain('Inicio')
    expect(html).toContain('Facturas')
    expect(html).toContain('Clientes')
    expect(html).toContain('Servicios')
    expect(html).toContain('Más')
    expect(html).not.toContain('hero-card')
    expect(html).not.toContain('cc-shell-nav')
  })
})
