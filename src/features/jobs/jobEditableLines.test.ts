import { describe, expect, it } from 'vitest'
import { createBlankBillingLine } from '../shared/billingLineDrafts'
import { buildEditableJobLinesFromJob, buildLegacyEditableLine, normalizeEditableJobLines } from './jobEditableLines'
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

describe('jobEditableLines', () => {
  it('builds 3 editable lines from persisted billing_lines with numeric strings', () => {
    const lines = buildEditableJobLinesFromJob(createJob({
      billing_lines: [
        { id: 'l2', sort_order: '2' as never, concept: 'Cristales', quantity: '1' as never, unit: 'servicio', unit_price: '25' as never, line_subtotal: '25' as never },
        { id: 'l1', sort_order: '1' as never, concept: 'Limpieza general', quantity: '2' as never, unit: 'hora', unit_price: '40' as never, line_subtotal: '80' as never },
        { id: 'l3', sort_order: '3' as never, concept: 'Sabanas/toallas', quantity: '1' as never, unit: 'servicio', unit_price: '15' as never, line_subtotal: '15' as never },
      ] as never,
    }))

    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ concept: 'Limpieza general', quantity: '2.00', unit_price: '40.00' })
    expect(lines[1]).toMatchObject({ concept: 'Cristales', quantity: '1.00', unit_price: '25.00' })
    expect(lines[2]).toMatchObject({ concept: 'Sabanas/toallas', quantity: '1.00', unit_price: '15.00' })
  })

  it('uses legacy fallback only when billing_lines are missing', () => {
    const lines = buildLegacyEditableLine(createJob({
      billing_lines: [],
      billing_concept: 'Servicio legacy',
      billing_quantity: 3,
      billing_unit: 'hora',
      billing_unit_price: 30,
    }))

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ concept: 'Servicio legacy', quantity: '3.00', unit: 'hora', unit_price: '30.00' })
  })

  it('keeps editable state expanded when adding a fourth line', () => {
    const initialLines = buildEditableJobLinesFromJob(createJob({
      billing_lines: [
        { id: 'l1', sort_order: 1, concept: 'Limpieza general', quantity: 2, unit: 'hora', unit_price: 40, line_subtotal: 80 },
        { id: 'l2', sort_order: 2, concept: 'Cristales', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
        { id: 'l3', sort_order: 3, concept: 'Sabanas/toallas', quantity: 1, unit: 'servicio', unit_price: 15, line_subtotal: 15 },
      ],
    }))
    const expandedLines = [...initialLines, createBlankBillingLine({ concept: 'Desplazamiento', unit_price: '12.00' })]
    const normalized = normalizeEditableJobLines([
      { concept: expandedLines[0].concept, quantity: Number(expandedLines[0].quantity), unit: expandedLines[0].unit, unit_price: Number(expandedLines[0].unit_price), line_subtotal: 80, sort_order: 1 },
      { concept: expandedLines[1].concept, quantity: Number(expandedLines[1].quantity), unit: expandedLines[1].unit, unit_price: Number(expandedLines[1].unit_price), line_subtotal: 25, sort_order: 2 },
      { concept: expandedLines[2].concept, quantity: Number(expandedLines[2].quantity), unit: expandedLines[2].unit, unit_price: Number(expandedLines[2].unit_price), line_subtotal: 15, sort_order: 3 },
      { concept: expandedLines[3].concept, quantity: Number(expandedLines[3].quantity), unit: expandedLines[3].unit, unit_price: Number(expandedLines[3].unit_price), line_subtotal: 12, sort_order: 4 },
    ])

    expect(expandedLines).toHaveLength(4)
    expect(expandedLines[0].concept).toBe('Limpieza general')
    expect(expandedLines[3]).toMatchObject({ concept: 'Desplazamiento' })
    expect(normalized).toHaveLength(4)
  })

  it('builds editable lines from snake_case drifted job_lines when billing_lines is absent', () => {
    const lines = buildEditableJobLinesFromJob(createJob({
      billing_lines: undefined,
      job_lines: [
        { id: 'l1', sort_order: 1, concept: 'Limpieza general', quantity: 2, unit: 'hora', unit_price: 40, line_subtotal: 80 },
        { id: 'l2', sort_order: 2, concept: 'Cristales', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
      ],
    }))

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ concept: 'Limpieza general', quantity: '2.00', unit_price: '40.00' })
    expect(lines[1]).toMatchObject({ concept: 'Cristales', quantity: '1.00', unit_price: '25.00' })
  })
})
