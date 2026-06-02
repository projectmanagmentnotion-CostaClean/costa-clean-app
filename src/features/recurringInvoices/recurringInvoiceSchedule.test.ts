import { describe, expect, it } from 'vitest'
import {
  calculateNextRecurringIssueDate,
  getRecurringFrequencyLabel,
  isRecurringPlanDue,
} from './recurringInvoiceSchedule'

describe('recurringInvoiceSchedule', () => {
  it('calculates the next monthly issue date', () => {
    expect(calculateNextRecurringIssueDate('monthly', '2026-06-02')).toBe('2026-07-02')
  })

  it('calculates the next biweekly issue date', () => {
    expect(calculateNextRecurringIssueDate('biweekly', '2026-06-02')).toBe('2026-06-16')
  })

  it('detects due plans against a provided date', () => {
    expect(isRecurringPlanDue('2026-06-01', new Date('2026-06-02T10:30:00'))).toBe(true)
    expect(isRecurringPlanDue('2026-06-03', new Date('2026-06-02T10:30:00'))).toBe(false)
  })

  it('returns translated cadence labels', () => {
    expect(getRecurringFrequencyLabel('quarterly')).toBe('Trimestral')
  })
})
