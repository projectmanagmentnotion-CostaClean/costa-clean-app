import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareDocumentSummary } from './utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('document feedback', () => {
  it('reports successful clipboard fallback through the shared toast API', async () => {
    const success = vi.fn()
    const error = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await shareDocumentSummary(
      'Factura 2026-049',
      ['Total: 121,00 €'],
      'Resumen copiado.',
      'No se pudo copiar.',
      { success, error },
    )

    expect(writeText).toHaveBeenCalledWith('Factura 2026-049\nTotal: 121,00 €')
    expect(success).toHaveBeenCalledWith('Resumen copiado', 'Resumen copiado.')
    expect(error).not.toHaveBeenCalled()
  })

  it('reports clipboard failure through accessible non-blocking feedback', async () => {
    const success = vi.fn()
    const error = vi.fn()
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'))

    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await shareDocumentSummary(
      'Presupuesto 2026-049',
      ['Total: 121,00 €'],
      'Resumen copiado.',
      'No se pudo copiar.',
      { success, error },
    )

    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('No se pudo compartir el resumen', 'No se pudo copiar.', { persistent: true })
  })
})
