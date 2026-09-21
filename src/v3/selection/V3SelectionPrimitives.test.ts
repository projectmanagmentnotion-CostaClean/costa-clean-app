import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3SelectionConfirmSheet } from './V3SelectionPrimitives'

describe('V3SelectionConfirmSheet', () => {
  it('uses a caller-provided confirmation label without changing the shared default', () => {
    const invoiceHtml = renderToStaticMarkup(createElement(V3SelectionConfirmSheet, {
      title: 'Confirmar cobros por transferencia',
      description: 'Se registrará un cobro por transferencia.',
      confirmLabel: 'Registrar cobros',
      onClose: () => undefined,
      onConfirm: () => undefined,
    }))
    const defaultHtml = renderToStaticMarkup(createElement(V3SelectionConfirmSheet, {
      title: 'Confirmar',
      description: 'Acción pendiente.',
      onClose: () => undefined,
      onConfirm: () => undefined,
    }))

    expect(invoiceHtml).toContain('Registrar cobros')
    expect(defaultHtml).toContain('Confirmar')
  })
})
