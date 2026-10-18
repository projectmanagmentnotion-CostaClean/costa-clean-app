import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3DuplicateReviewSheet } from './V3DuplicateReviewSheet'

describe('V3DuplicateReviewSheet', () => {
  it('preserves record severity and facts needed for an informed duplicate decision', () => {
    const html = renderToStaticMarkup(createElement(V3DuplicateReviewSheet, {
      title: 'Revisión de duplicados',
      description: 'Revisa la coincidencia.',
      groups: [{
        entityType: 'job',
        groupId: 'job-group-1',
        severity: 'strong',
        reasons: [{ code: 'job-core-context', label: 'Coinciden cliente y fecha', severity: 'strong' }],
        records: [{
          entityType: 'job',
          recordId: 'job-1',
          record: { id: 'job-1' },
          severity: 'probable',
          reasons: [],
          summary: { title: 'Servicio existente', subtitle: 'Cliente · inmueble', meta: ['12/09/2026'], facts: [{ label: 'Estado', value: 'Programado' }] },
        }],
      }],
      onClose: () => undefined,
    }))

    expect(html).toContain('Coinciden cliente y fecha')
    expect(html).toContain('Coincidencia probable')
    expect(html).toContain('Estado')
    expect(html).toContain('Programado')
  })
})
