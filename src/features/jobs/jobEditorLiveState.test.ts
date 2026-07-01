import { describe, expect, it } from 'vitest'
import { createBlankBillingLine } from '../shared/billingLineDrafts'
import {
  appendBillingLine,
  buildJobEditorValidation,
  buildOptimisticJobAfterSave,
  resolveJobAfterRefresh,
  shouldShowJobLineDebug,
} from './jobEditorLiveState'
import type { JobBillingLineItem, JobListItem } from './types'

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
    billing_concept: 'Limpieza general',
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 90,
    billing_lines: [
      { id: 'line-1', sort_order: 1, concept: 'Limpieza general', quantity: 1, unit: 'servicio', unit_price: 90, line_subtotal: 90 },
    ],
    notes: 'Notas previas',
    ...overrides,
  }
}

function createLines(): JobBillingLineItem[] {
  return [
    { id: 'line-1', sort_order: 1, concept: 'Limpieza general', quantity: 2, unit: 'hora', unit_price: 40, line_subtotal: 80 },
    { id: 'line-2', sort_order: 2, concept: 'Cristales', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
  ]
}

describe('jobEditorLiveState', () => {
  it('appends a third local line without mutating the current editor state', () => {
    const initial = [
      createBlankBillingLine({ concept: 'Limpieza general' }),
      createBlankBillingLine({ concept: 'Cristales' }),
    ]

    const next = appendBillingLine(initial)

    expect(initial).toHaveLength(2)
    expect(next).toHaveLength(3)
    expect(next[2]?.concept).toBe('')
  })

  it('returns blocking validation and line warnings for invalid lines', () => {
    const invalidLine = createBlankBillingLine({
      concept: '',
      quantity: '0',
      unit_price: '-10',
    })

    const result = buildJobEditorValidation(
      [invalidLine],
      { client_id: 'client-1', property_id: 'property-1', scheduled_date: '2026-07-01' },
    )

    expect(result.blockingMessage).toBe('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
    expect(JSON.stringify(result.lineWarnings[invalidLine.local_id])).toBe(JSON.stringify([
      'Falta el concepto.',
      'La cantidad debe ser mayor que 0.',
      'El precio unitario no puede ser negativo.',
    ]))
    expect(JSON.stringify(result.globalWarnings)).toBe(JSON.stringify([
      'El subtotal del servicio es 0 EUR. Revisa si falta precio en alguna linea.',
    ]))
  })

  it('keeps the optimistic job when the remote refresh is stale', () => {
    const optimisticJob = createJob({ billing_lines: createLines(), billing_unit_price: 105 })
    const staleRemoteJob = createJob({ billing_lines: [], billing_unit_price: 90 })

    const result = resolveJobAfterRefresh({
      optimisticJob,
      remoteJob: staleRemoteJob,
    })

    expect(result.status).toBe('refresh_warning')
    expect(result.job.billing_lines).toHaveLength(2)
    expect(result.message.includes('version local')).toBe(true)
  })

  it('uses the remote job when the refresh already returned the saved state', () => {
    const optimisticJob = createJob({ billing_lines: createLines(), billing_unit_price: 105 })
    const syncedRemoteJob = createJob({
      billing_lines: [
        { id: 'server-1', sort_order: 1, concept: 'Limpieza general', quantity: 2, unit: 'hora', unit_price: 40, line_subtotal: 80 },
        { id: 'server-2', sort_order: 2, concept: 'Cristales', quantity: 1, unit: 'servicio', unit_price: 25, line_subtotal: 25 },
      ],
      billing_unit_price: 105,
    })

    const result = resolveJobAfterRefresh({
      optimisticJob,
      remoteJob: syncedRemoteJob,
    })

    expect(result.status).toBe('synced')
    expect(result.job.billing_lines?.[0]?.id).toBe('server-1')
  })

  it('rebuilds an optimistic job snapshot with full line state', () => {
    const optimisticJob = buildOptimisticJobAfterSave({
      job: createJob(),
      form: {
        client_id: 'client-2',
        property_id: 'property-2',
        quote_id: 'quote-2',
        scheduled_date: '2026-07-05',
        status: 'completed',
        service_type: 'deep_cleaning',
        notes: '  Notas nuevas  ',
      },
      lines: createLines(),
      billingSummary: {
        billing_concept: 'Limpieza general',
        billing_quantity: 1,
        billing_unit: 'servicio',
        billing_unit_price: 105,
      },
    })

    expect(optimisticJob).toMatchObject({
      client_id: 'client-2',
      property_id: 'property-2',
      quote_id: 'quote-2',
      status: 'completed',
      service_type: 'deep_cleaning',
      billing_unit_price: 105,
      notes: 'Notas nuevas',
    })
    expect(optimisticJob.billing_lines).toHaveLength(2)
    expect(optimisticJob.job_lines).toHaveLength(2)
  })

  it('shows debug only in dev mode or when the query flag is present', () => {
    expect(shouldShowJobLineDebug('', false)).toBe(false)
    expect(shouldShowJobLineDebug('?debugJobLines=1', false)).toBe(true)
    expect(shouldShowJobLineDebug('', true)).toBe(true)
  })
})
