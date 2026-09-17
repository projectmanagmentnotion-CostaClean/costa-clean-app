import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3JobRow } from './V3JobRow'

describe('V3JobRow', () => {
  it('uses human-safe fallbacks and names the separate operational and billing states', () => {
    const uuid = '11111111-1111-4111-8111-111111111111'
    const html = renderToStaticMarkup(createElement(V3JobRow, {
      job: {
        id: uuid,
        display_code: null,
        client_id: uuid,
        property_id: uuid,
        quote_id: null,
        scheduled_date: '2026-09-17',
        status: 'scheduled',
        service_type: 'Limpieza',
      },
      invoice: null,
      today: '2026-09-16',
      onOpen: () => undefined,
    }))

    expect(html).toContain('Cliente sin identificar')
    expect(html).toContain('Inmueble sin identificar')
    expect(html).toContain('Servicio')
    expect(html).toContain('Facturación')
    expect(html).toContain('Sin facturar')
    expect(html).not.toContain(uuid)
  })
})
