import type { RecurringInvoiceFrequency } from './types'

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function getRecurringFrequencyLabel(frequency: RecurringInvoiceFrequency): string {
  switch (frequency) {
    case 'weekly': return 'Semanal'
    case 'biweekly': return 'Quincenal'
    case 'monthly': return 'Mensual'
    case 'quarterly': return 'Trimestral'
  }
}

export function calculateNextRecurringIssueDate(
  frequency: RecurringInvoiceFrequency,
  currentDate: string,
): string {
  const nextDate = parseDate(currentDate)

  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
  }

  return toDateKey(nextDate)
}

export function isRecurringPlanDue(nextIssueDate: string, today = new Date()): boolean {
  const dueDate = parseDate(nextIssueDate)
  const normalizedToday = new Date(today)
  normalizedToday.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate.getTime() <= normalizedToday.getTime()
}
