import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3SelectionResultSheet } from './V3SelectionPrimitives'

describe('V3 selection result presentation', () => {
  it('renders counts instead of technical selection ids', () => {
    const uuid = 'e1643c33-ae20-48cd-a2c7-99fd41184533'
    const html = renderToStaticMarkup(createElement(V3SelectionResultSheet, {
      message: 'Proceso completado',
      completedIds: [uuid, 'invoice-2'],
      failedIds: [uuid],
      onClose: () => undefined,
    }))
    expect(html).toContain('Completadas: 2')
    expect(html).toContain('Fallidas: 1')
    expect(html).not.toContain(uuid)
  })
})
