import { describe, expect, it } from 'vitest'
import { buildJobLinePayloads } from './jobWriteApi'

describe('jobWriteApi', () => {
  it('builds a payload per line without fusing concepts or order', () => {
    const payloads = buildJobLinePayloads([
      {
        id: 'line-1',
        sort_order: 1,
        concept: 'Limpieza general',
        quantity: 2,
        unit: 'hora',
        unit_price: 40,
        line_subtotal: 80,
      },
      {
        id: 'line-2',
        sort_order: 2,
        concept: 'Cristales',
        quantity: 1,
        unit: 'servicio',
        unit_price: 25,
        line_subtotal: 25,
      },
      {
        id: 'line-3',
        sort_order: 3,
        concept: 'Desplazamiento',
        quantity: 1,
        unit: 'servicio',
        unit_price: 10,
        line_subtotal: 10,
      },
    ], 'job-1')

    expect(payloads).toHaveLength(3)
    expect(payloads[0]).toMatchObject({ job_id: 'job-1', sort_order: 1, concept: 'Limpieza general' })
    expect(payloads[1]).toMatchObject({ job_id: 'job-1', sort_order: 2, concept: 'Cristales' })
    expect(payloads[2]).toMatchObject({ job_id: 'job-1', sort_order: 3, concept: 'Desplazamiento' })
  })
})
