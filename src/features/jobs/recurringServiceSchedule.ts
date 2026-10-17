export type RecurringScheduleKind = 'weekly' | 'biweekly' | 'monthly'

export interface RecurringSchedulePlan {
  schedule_kind: RecurringScheduleKind
  weekdays?: number[] | null
  monthly_day?: number | null
  start_date: string
  end_date?: string | null
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

function dayDistance(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export function getRecurringOccurrenceDates(plan: RecurringSchedulePlan, fromDate: string, throughDate: string): string[] {
  const start = parseDate(plan.start_date)
  const from = parseDate(fromDate) < start ? start : parseDate(fromDate)
  const through = parseDate(throughDate)
  const end = plan.end_date && parseDate(plan.end_date) < through ? parseDate(plan.end_date) : through
  if (from > end) return []

  const weekdays = new Set(plan.weekdays ?? [])
  const dates: string[] = []
  for (let cursor = new Date(from); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekday = isoWeekday(cursor)
    if (plan.schedule_kind === 'monthly') {
      if (cursor.getUTCDate() === plan.monthly_day) dates.push(formatDate(cursor))
      continue
    }
    if (!weekdays.has(weekday)) continue
    if (plan.schedule_kind === 'biweekly' && Math.floor(dayDistance(start, cursor) / 7) % 2 !== 0) continue
    dates.push(formatDate(cursor))
  }
  return dates
}

export function formatRecurringSchedule(plan: RecurringSchedulePlan): string {
  if (plan.schedule_kind === 'monthly') return `Mensual · día ${plan.monthly_day}`
  const days = (plan.weekdays ?? []).join(', ')
  return `${plan.schedule_kind === 'biweekly' ? 'Quincenal' : 'Semanal'} · ${days}`
}
