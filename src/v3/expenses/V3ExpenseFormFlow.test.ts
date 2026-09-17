import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3ExpenseFormFlow } from './V3ExpenseFormFlow'

describe('V3ExpenseFormFlow', () => {
  it('groups the form from identity through financial and private-document context', () => {
    const html = renderToStaticMarkup(createElement(V3ExpenseFormFlow, {
      mode: 'create',
      expenses: [],
      onRefresh: async () => undefined,
      onCompleted: () => undefined,
      onCancel: () => undefined,
    }))

    expect(html).toContain('Identificación')
    expect(html).toContain('Importe e impuestos')
    expect(html).toContain('Soporte y revisión')
    expect(html).toContain('Documento (opcional, máximo 10 MB)')
    expect(html).toContain('flujo privado existente')
    expect(html.indexOf('Identificación')).toBeLessThan(html.indexOf('Importe e impuestos'))
    expect(html.indexOf('Importe e impuestos')).toBeLessThan(html.indexOf('Soporte y revisión'))
  })
})
