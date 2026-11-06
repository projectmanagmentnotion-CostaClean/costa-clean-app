import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3StepFlow } from './V3StepFlow'

describe('V3StepFlow', () => {
  it('renders only the active step with progress and navigation', () => {
    const html = renderToStaticMarkup(createElement(V3StepFlow, {
      title: 'Editar servicio',
      steps: [
        { id: 'schedule', title: 'Agenda', content: createElement('input', { 'aria-label': 'Fecha' }) },
        { id: 'billing', title: 'Precio', content: createElement('p', null, 'Campos de facturación') },
      ],
      onCancel: () => undefined,
      onComplete: () => undefined,
      completeLabel: 'Guardar cambios',
    }))

    expect(html).toContain('Paso 1 de 2')
    expect(html).toContain('Agenda')
    expect(html).toContain('Continuar')
    expect(html).not.toContain('Campos de facturación')
  })

  it('announces save errors inside the guided flow', () => {
    const html = renderToStaticMarkup(createElement(V3StepFlow, {
      title: 'Editar servicio',
      steps: [{ id: 'schedule', title: 'Agenda', content: createElement('input') }],
      onCancel: () => undefined,
      onComplete: () => undefined,
      completeLabel: 'Guardar cambios',
      error: 'No se pudo guardar el servicio.',
    }))

    expect(html).toContain('role="alert"')
    expect(html).toContain('No se pudo guardar el servicio.')
  })
})
