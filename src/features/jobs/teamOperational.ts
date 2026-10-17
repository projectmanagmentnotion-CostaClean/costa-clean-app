export interface TeamMember {
  id: string
  display_code?: string | null
  full_name: string
  status: 'active' | 'inactive'
  default_hourly_cost: number | null
  phone?: string | null
  notes?: string | null
  archived_at?: string | null
}

export interface JobTeamAssignment {
  id: string
  job_id: string
  team_member_id: string
  planned_minutes: number | null
  hourly_cost_snapshot: number | null
  status: 'assigned' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
}

export interface JobTimeEntry {
  id: string
  job_id: string
  team_member_id: string
  work_date: string
  minutes: number
  hourly_cost_snapshot: number | null
  source: 'manual'
  notes?: string | null
}

export function normalizeHoursToMinutes(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Las horas deben ser mayores que cero.')
  const minutes = Math.round(hours * 60)
  if (minutes <= 0 || minutes > 1440) throw new Error('Las horas deben equivaler a entre 1 y 1440 minutos.')
  return minutes
}

export function calculateLaborCost(minutes: number, hourlyCost: number | null | undefined) {
  if (hourlyCost == null) return null
  return Math.round((minutes / 60 * hourlyCost + Number.EPSILON) * 100) / 100
}

export function summarizeJobLabor(assignments: JobTeamAssignment[], entries: JobTimeEntry[]) {
  const plannedMinutes = assignments.reduce((sum, item) => sum + (item.planned_minutes ?? 0), 0)
  const actualMinutes = entries.reduce((sum, item) => sum + item.minutes, 0)
  const plannedLaborCost = assignments.reduce((sum, item) => sum + (calculateLaborCost(item.planned_minutes ?? 0, item.hourly_cost_snapshot) ?? 0), 0)
  const actualLaborCost = entries.reduce((sum, item) => sum + (calculateLaborCost(item.minutes, item.hourly_cost_snapshot) ?? 0), 0)
  return {
    plannedMinutes,
    actualMinutes,
    plannedLaborCost: Math.round((plannedLaborCost + Number.EPSILON) * 100) / 100,
    actualLaborCost: Math.round((actualLaborCost + Number.EPSILON) * 100) / 100,
  }
}
