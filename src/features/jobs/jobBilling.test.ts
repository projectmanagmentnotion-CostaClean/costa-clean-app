import { describe, expect, it } from 'vitest'
import { getJobBillingDisplayConcept, getJobBillingDraftLines, getJobBillingLines } from './jobBilling'
import type { JobListItem } from './types'

function createJob(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'job-1',
    display_code: 'JOB-001',
    client_id: 'client-1',
    property_id: 'property-1',
    quote_id: null,
    scheduled_date: '2026-07-01',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    billing_concept: 'Resumen legacy',
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 90,
    billing_lines: [],
    notes: null,
    ...overrides,
  }
}

describe('jobBilling', () => {
  it('uses persisted job_lines in stable sort order when they exist', () => {
    const lines = getJobBillingLines(createJob({
      billing_quantity: 999,
      billing_unit_price: 999,
      billing_lines: [
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
          id: 'line-1',
          sort_order: 1,
          concept: 'Limpieza general',
          quantity: 2,
          unit: 'hora',
          unit_price: 40,
          line_subtotal: 80,
        },
      ],
    }))

    expect(lines).toHaveLength(2)
    expect(lines[0].concept).toBe('Limpieza general')
    expect(lines[1].concept).toBe('Cristales')
    expect(lines[0].line_subtotal).toBe(80)
  })

  it('does not generate a summary concept when persisted billing_lines exist', () => {
    const job = createJob({
      billing_concept: 'Limpieza estandar (+2 linea(s))',
      billing_lines: [
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
          concept: 'Sabanas/toallas',
          quantity: 1,
          unit: 'servicio',
          unit_price: 10,
          line_subtotal: 10,
        },
      ],
    })

    const lines = getJobBillingLines(job)

    expect(lines).toHaveLength(3)
    expect(lines[0].concept).toBe('Limpieza general')
    expect(lines[1].concept).toBe('Cristales')
    expect(lines[2].concept).toBe('Sabanas/toallas')
    expect(getJobBillingDisplayConcept(job)).toBe('Limpieza general')
  })

  it('accepts persisted billing_lines even when REST numeric fields arrive as strings', () => {
    const job = createJob({
      billing_lines: [
        {
          id: 'line-2',
          sort_order: '2' as never,
          concept: 'Cristales',
          quantity: '1' as never,
          unit: 'servicio',
          unit_price: '25' as never,
          line_subtotal: '25' as never,
        },
        {
          id: 'line-1',
          sort_order: '1' as never,
          concept: 'Limpieza general',
          quantity: '2' as never,
          unit: 'hora',
          unit_price: '40' as never,
          line_subtotal: '80' as never,
        },
        {
          id: 'line-3',
          sort_order: '3' as never,
          concept: 'Sabanas/toallas',
          quantity: '1' as never,
          unit: 'servicio',
          unit_price: '15' as never,
          line_subtotal: '15' as never,
        },
      ] as never,
    })

    const lines = getJobBillingLines(job)
    const draftLines = getJobBillingDraftLines(job)

    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ concept: 'Limpieza general', quantity: 2, unit_price: 40, line_subtotal: 80 })
    expect(lines[1]).toMatchObject({ concept: 'Cristales', quantity: 1, unit_price: 25, line_subtotal: 25 })
    expect(lines[2]).toMatchObject({ concept: 'Sabanas/toallas', quantity: 1, unit_price: 15, line_subtotal: 15 })
    expect(draftLines).toHaveLength(3)
    expect(draftLines[0]).toMatchObject({ concept: 'Limpieza general', quantity: '2.00', unit_price: '40.00' })
    expect(draftLines[1]).toMatchObject({ concept: 'Cristales', quantity: '1.00', unit_price: '25.00' })
    expect(draftLines[2]).toMatchObject({ concept: 'Sabanas/toallas', quantity: '1.00', unit_price: '15.00' })
  })

  it('falls back to legacy summary only when there are no persisted lines', () => {
    const lines = getJobBillingLines(createJob({
      billing_lines: [],
      billing_concept: 'Servicio legacy',
      billing_quantity: 3,
      billing_unit: 'hora',
      billing_unit_price: 30,
    }))

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      concept: 'Servicio legacy',
      quantity: 3,
      unit: 'hora',
      unit_price: 30,
      line_subtotal: 90,
    })
  })
})
