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

    expect(html).toContain('Datos básicos')
    expect(html).toContain('Importe e impuestos')
    expect(html).toContain('Revisión fiscal')
    expect(html).toContain('Paso 1 de 5')
    expect(html).toContain('data-step-body-scroll="0"')
    expect(html).not.toContain('Documento (opcional, máximo 10 MB)')
    expect(html).toContain('Continuar')
  })
})
