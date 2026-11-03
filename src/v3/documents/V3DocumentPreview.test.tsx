import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3DocumentPreview, V3DocumentPreviewLoading } from './V3DocumentPreview'

const baseProps = {
  documentKind: 'invoice' as const,
  title: 'Vista previa de factura',
  description: 'Documento A4 real.',
  statusLabel: 'Emitida',
  statusTone: 'neutral' as const,
  error: null,
  onOpenDocument: () => undefined,
  children: null,
}

describe('V3DocumentPreview', () => {
  it('uses one shared shell for the open action, status and canonical document surface', () => {
    const html = renderToStaticMarkup(createElement(V3DocumentPreview, baseProps, createElement('div', { className: 'cc-invoice-a4--embedded' }, 'Factura A4')))

    expect(html).toContain('v3-document-preview--invoice')
    expect(html).toContain('cc-doc-preview-panel')
    expect(html).toContain('Abrir documento')
    expect(html).toContain('La miniatura usa el mismo documento A4 canónico')
    expect(html).toContain('Factura A4')
  })

  it('keeps loading content inside the same document thumbnail surface', () => {
    const html = renderToStaticMarkup(createElement(V3DocumentPreview, { ...baseProps, error: null }, createElement(V3DocumentPreviewLoading, { label: 'Cargando líneas', description: 'Preparando el documento canónico.' })))

    expect(html).toContain('Cargando líneas: Preparando el documento canónico.')
    expect(html).toContain('cc-doc-preview-panel__thumbnail')
  })

  it('exposes the canonical renderer error without replacing the document action contract', () => {
    const html = renderToStaticMarkup(createElement(V3DocumentPreview, { ...baseProps, error: 'No hay líneas disponibles.' }, createElement('div', null, 'no debe aparecer')))

    expect(html).toContain('No se pudo cargar la vista previa')
    expect(html).toContain('No hay líneas disponibles.')
    expect(html).toContain('Abrir documento')
    expect(html).not.toContain('no debe aparecer')
  })
})
