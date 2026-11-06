import { getSupabaseClient } from '../../lib/supabase'
import { getRecurringOccurrenceDates, type RecurringSchedulePlan } from './recurringServiceSchedule'

export interface RecurringServicePlan extends RecurringSchedulePlan {
  id: string
  client_id: string
  property_id: string
  title: string
  service_type: string
  status: 'active' | 'paused' | 'ended' | 'archived'
  billing_concept: string | null
  billing_quantity: number | null
  billing_unit: string | null
  billing_unit_price: number | null
  template_lines: Array<Record<string, unknown>>
  notes: string | null
  internal_notes: string | null
  last_generated_through: string | null
  timezone: string
  default_start_time: string | null
  default_duration_minutes: number | null
  default_workers_required: number | null
}

export interface RecurringServiceSlot {
  weekday: number
  start_time: string | null
  duration_minutes: number
  workers_required: number
}

export interface RecurringServiceOccurrence {
  recurring_service_plan_id: string
  occurrence_date: string
  status: 'planned' | 'skipped' | 'generated'
  start_time: string | null
  duration_minutes: number
  workers_required: number
  job_id: string | null
}

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  return client
}

export async function listRecurringServicePlans(): Promise<RecurringServicePlan[]> {
  const { data, error } = await getClientOrThrow().from('recurring_service_plans').select('*').neq('status', 'archived').order('title')
  if (error) throw new Error(error.message)
  return (data ?? []) as RecurringServicePlan[]
}

export async function saveRecurringServicePlan(plan: Record<string, unknown>): Promise<RecurringServicePlan> {
  const { data, error } = await getClientOrThrow().rpc('save_recurring_service_plan', { p_plan: plan })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudo guardar el plan recurrente.')
  return data as RecurringServicePlan
}

export async function listRecurringServiceOccurrences(fromDate: string, throughDate: string): Promise<RecurringServiceOccurrence[]> {
  const { data, error } = await getClientOrThrow().from('recurring_service_occurrences').select('recurring_service_plan_id,occurrence_date,status,start_time,duration_minutes,workers_required,job_id').gte('occurrence_date', fromDate).lte('occurrence_date', throughDate).order('occurrence_date').order('start_time')
  if (error) throw new Error(error.message)
  return (data ?? []) as RecurringServiceOccurrence[]
}

export async function listRecurringServicePlanSlots(planId: string): Promise<RecurringServiceSlot[]> {
  const { data, error } = await getClientOrThrow().from('recurring_service_plan_slots').select('weekday,start_time,duration_minutes,workers_required').eq('recurring_service_plan_id', planId).order('weekday')
  if (error) throw new Error(error.message)
  return (data ?? []) as RecurringServiceSlot[]
}

export async function saveRecurringServicePlanSchedule(planId: string, slots: RecurringServiceSlot[]) {
  const { data, error } = await getClientOrThrow().rpc('save_recurring_service_plan_schedule', { p_plan_id: planId, p_slots: slots })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudo guardar el horario recurrente.')
  return data as { plan_id: string; slot_count: number }
}

export async function generateRecurringServiceOccurrences(planId: string, fromDate: string, throughDate: string) {
  const { data, error } = await getClientOrThrow().rpc('generate_recurring_service_occurrences', {
    p_plan_id: planId,
    p_from_date: fromDate,
    p_through_date: throughDate,
  })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudieron generar las visitas.')
  return data as { expected_count: number; created_count: number; existing_count: number; job_ids: string[] }
}

export async function setRecurringServicePlanStatus(planId: string, status: 'active' | 'paused' | 'ended' | 'archived') {
  const { data, error } = await getClientOrThrow().rpc('set_recurring_service_plan_status', { p_plan_id: planId, p_status: status })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudo actualizar el plan recurrente.')
  return data as RecurringServicePlan
}

export async function setRecurringServiceOccurrence(planId: string, occurrenceDate: string, status: 'planned' | 'skipped', patch: Partial<RecurringServiceSlot> = {}) {
  const { data, error } = await getClientOrThrow().rpc('set_recurring_service_occurrence', {
    p_plan_id: planId,
    p_occurrence_date: occurrenceDate,
    p_status: status,
    p_patch: patch,
  })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudo actualizar la visita recurrente.')
  return data as Record<string, unknown>
}

export { getRecurringOccurrenceDates }
