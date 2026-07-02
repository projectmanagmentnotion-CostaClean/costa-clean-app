import { describe, expect, it } from 'vitest'
import { attachJobLinesToJobs, buildJobLinesDebugPayload, groupJobLines, hydrateLegacyProperties } from './appDataApi'
import type { JobListItem } from '../features/jobs/types'
import type { PropertyListItem } from '../features/properties/types'

function createJob(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0',
    display_code: 'JOB-0052',
    client_id: 'client-1',
    property_id: 'property-1',
    quote_id: null,
    scheduled_date: '2026-07-01',
    status: 'in_progress',
    service_type: 'deep_cleaning',
    billing_concept: 'Limpieza estandar',
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: 277,
    billing_lines: [],
    notes: null,
    ...overrides,
  }
}

describe('appDataApi helpers', () => {
  it('hydrates legacy properties without lifecycle/status columns', () => {
    const legacyProperties: Array<
      Pick<PropertyListItem, 'id' | 'display_code' | 'client_id' | 'name' | 'property_type' | 'address' | 'city' | 'postal_code' | 'notes'>
    > = [
      {
        id: 'property-1',
        display_code: 'PROP-001',
        client_id: 'client-1',
        name: 'Piso Eixample',
        property_type: 'flat',
        address: 'Calle Mallorca 20',
        city: 'Barcelona',
        postal_code: '08029',
        notes: null,
      },
    ]

    const hydrated = hydrateLegacyProperties(legacyProperties)
    expect(hydrated).toHaveLength(1)
    expect(hydrated[0]).toMatchObject({
      id: 'property-1',
      status: 'active',
      archived_at: null,
      deleted_at: null,
    })
  })

  it('attaches grouped job_lines to the matching job id', () => {
    const jobs = [createJob()]
    const linesByJobId = groupJobLines([
      {
        id: 'line-2',
        job_id: 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0',
        sort_order: '2',
        concept: 'Cristales',
        quantity: '1',
        unit: 'servicio',
        unit_price: '25',
        line_subtotal: '25',
      },
      {
        id: 'line-1',
        job_id: 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0',
        sort_order: '1',
        concept: 'Limpieza general',
        quantity: '2',
        unit: 'hora',
        unit_price: '126',
        line_subtotal: '252',
      },
    ])

    const hydratedJobs = attachJobLinesToJobs(jobs, linesByJobId)

    expect(hydratedJobs).toHaveLength(1)
    expect(hydratedJobs[0].billing_lines).toHaveLength(2)
    expect(hydratedJobs[0].billing_lines?.[0]).toMatchObject({
      id: 'line-1',
      concept: 'Limpieza general',
      quantity: 2,
      unit_price: 126,
      line_subtotal: 252,
    })
    expect(hydratedJobs[0].billing_lines?.[1]).toMatchObject({
      id: 'line-2',
      concept: 'Cristales',
      quantity: 1,
      unit_price: 25,
      line_subtotal: 25,
    })
  })

  it('builds visible debug payload for job_lines read failures', () => {
    const payload = buildJobLinesDebugPayload({
      accessToken: 'session-token',
      loadedJobs: [createJob()],
      sampleJobId: 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0',
      sessionError: null,
      jobLines: [],
      jobLinesFetchStatus: 403,
      jobLinesError: 'REST 403: permission denied for table job_lines',
    })

    expect(payload).toMatchObject({
      authMode: 'session',
      attachedPropertyName: 'billing_lines',
      jobCount: 1,
      jobLinesFetchStatus: 403,
      jobLinesError: 'REST 403: permission denied for table job_lines',
      jobLinesRawCount: 0,
      sampleJobId: 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0',
    })
    expect(payload.groupedJobIds).toHaveLength(0)
    expect(payload.sampleForJob0052).toHaveLength(0)
  })
})
