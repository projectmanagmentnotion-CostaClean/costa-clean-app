import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { V3ExpenseCaptureEntry } from './V3ExpenseCaptureEntry'

describe('V3ExpenseCaptureEntry', () => {
  it('keeps camera, upload and manual routes visible together', () => {
    const html = renderToStaticMarkup(createElement(V3ExpenseCaptureEntry, {
      onManual: vi.fn(),
      onCancel: vi.fn(),
    }))
    expect(html).toContain('Hacer foto')
    expect(html).toContain('Subir ticket o factura')
    expect(html).toContain('Introducir gasto manualmente')
    expect(html).toContain('capture="environment"')
    expect(html).not.toContain('sin OCR')
  })
})
