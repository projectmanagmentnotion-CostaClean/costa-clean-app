import { describe, expect, it } from 'vitest'
import { getRecurringOccurrenceDates, getRecurringSlot } from './recurringServiceSchedule'

describe('recurring service schedule', () => {
  it('supports weekly Monday and multiple weekdays', () => {
    expect(getRecurringOccurrenceDates({ schedule_kind: 'weekly', weekdays: [1], start_date: '2026-09-28' }, '2026-09-28', '2026-10-04')).toEqual(['2026-09-28'])
    expect(getRecurringOccurrenceDates({ schedule_kind: 'weekly', weekdays: [1, 3, 5], start_date: '2026-09-28' }, '2026-09-28', '2026-10-04')).toEqual(['2026-09-28', '2026-09-30', '2026-10-02'])
  })

  it('supports all weekdays and biweekly anchor behavior', () => {
    expect(getRecurringOccurrenceDates({ schedule_kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], start_date: '2026-09-28' }, '2026-09-28', '2026-10-04')).toHaveLength(7)
    expect(getRecurringOccurrenceDates({ schedule_kind: 'biweekly', weekdays: [1], start_date: '2026-09-28' }, '2026-09-28', '2026-10-12')).toEqual(['2026-09-28', '2026-10-12'])
  })

  it('supports monthly day and plan end date', () => {
    expect(getRecurringOccurrenceDates({ schedule_kind: 'monthly', monthly_day: 15, start_date: '2026-09-01', end_date: '2026-11-20' }, '2026-09-01', '2026-12-31')).toEqual(['2026-09-15', '2026-10-15', '2026-11-15'])
  })

  it('returns no dates outside the bounded interval', () => {
    expect(getRecurringOccurrenceDates({ schedule_kind: 'weekly', weekdays: [1], start_date: '2026-09-28' }, '2026-09-29', '2026-09-30')).toEqual([])
  })

  it('keeps civil dates stable across month and year boundaries', () => {
    expect(getRecurringOccurrenceDates({ schedule_kind: 'weekly', weekdays: [5], start_date: '2026-12-31' }, '2026-12-31', '2027-01-08')).toEqual(['2027-01-01', '2027-01-08'])
  })

  it('resolves a per-weekday operational slot without applying timezone shifts', () => {
    const plan = { schedule_kind: 'weekly' as const, weekdays: [1, 6], start_date: '2026-09-28', timezone: 'Europe/Madrid', slots: [{ weekday: 1, start_time: '09:30', duration_minutes: 180, workers_required: 2 }, { weekday: 6, start_time: null, duration_minutes: 120, workers_required: 2 }] }
    expect(getRecurringSlot(plan, '2026-09-28')).toMatchObject({ start_time: '09:30', duration_minutes: 180 })
    expect(getRecurringSlot(plan, '2026-10-03')).toMatchObject({ start_time: null, duration_minutes: 120 })
  })
})
