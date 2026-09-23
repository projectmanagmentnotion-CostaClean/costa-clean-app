import { describe, expect, it } from 'vitest'
import { getRecurringOccurrenceDates } from './recurringServiceSchedule'

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
})
