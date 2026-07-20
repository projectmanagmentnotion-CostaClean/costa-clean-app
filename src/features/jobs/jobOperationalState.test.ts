import { describe, expect, it } from 'vitest'
import { getJobOperationalStatus, isUpcomingJob } from './jobOperationalState'
import type { JobListItem } from './types'

function createJob(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'job-1',
    display_code: 'SER-1',
    client_id: 'client-1',
    property_id: 'property-1',
    quote_id: null,
    scheduled_date: '2026-07-21',
    status: 'scheduled',
    service_type: 'standard_cleaning',
    ...overrides,
  }
}

describe('job operational state', () => {
  it('prioritizes upcoming scheduled and in-progress services', () => {
    expect(isUpcomingJob(createJob(), '2026-07-20')).toBe(true)
    expect(isUpcomingJob(createJob({ status: 'in_progress' }), '2026-07-20')).toBe(true)
    expect(isUpcomingJob(createJob({ status: 'completed' }), '2026-07-20')).toBe(false)
  })

  it('marks overdue open services for review', () => {
    const status = getJobOperationalStatus(createJob({ scheduled_date: '2026-07-19' }), '2026-07-20')
    expect(status.state).toBe('review')
    expect(status.label).toBe('Necesita revision')
  })

  it('keeps completed and cancelled states explicit', () => {
    expect(getJobOperationalStatus(createJob({ status: 'completed' }), '2026-07-20').label).toBe('Realizado')
    expect(getJobOperationalStatus(createJob({ status: 'cancelled' }), '2026-07-20').label).toBe('Cancelado')
  })
})
