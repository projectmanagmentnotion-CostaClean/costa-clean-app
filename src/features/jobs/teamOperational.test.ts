import { describe, expect, it } from 'vitest'
import { calculateLaborCost, normalizeHoursToMinutes, summarizeJobLabor } from './teamOperational'

describe('N5 team operational helpers', () => {
  it('normalizes fractional hours into integer minutes', () => {
    expect(normalizeHoursToMinutes(0.5)).toBe(30)
    expect(normalizeHoursToMinutes(1.5)).toBe(90)
    expect(() => normalizeHoursToMinutes(0)).toThrow()
    expect(() => normalizeHoursToMinutes(24.1)).toThrow()
  })

  it('rounds labor costs without changing the stored snapshot', () => {
    expect(calculateLaborCost(90, 20)).toBe(30)
    expect(calculateLaborCost(60, null)).toBeNull()
    const result = summarizeJobLabor(
      [{ id: 'a', job_id: 'j', team_member_id: 'm1', planned_minutes: 60, hourly_cost_snapshot: 20, status: 'assigned' }, { id: 'b', job_id: 'j', team_member_id: 'm2', planned_minutes: 30, hourly_cost_snapshot: 30, status: 'assigned' }],
      [{ id: 't1', job_id: 'j', team_member_id: 'm1', work_date: '2026-09-23', minutes: 45, hourly_cost_snapshot: 20, source: 'manual' }, { id: 't2', job_id: 'j', team_member_id: 'm2', work_date: '2026-09-23', minutes: 30, hourly_cost_snapshot: 30, source: 'manual' }],
    )
    expect(result).toEqual({ plannedMinutes: 90, actualMinutes: 75, plannedLaborCost: 35, actualLaborCost: 30 })
  })
})
