import { getSupabaseClient } from '../../lib/supabase'
import { getRecurringOccurrenceDates, type RecurringSchedulePlan } from './recurringServiceSchedule'

export interface RecurringServicePlan extends RecurringSchedulePlan {
  id: string
  client_id: string
  property_id: string
  title: string
  service_type: string
  status: 'active' | 'paused' | 'archived'
  billing_concept: string | null
  billing_quantity: number | null
  billing_unit: string | null
  billing_unit_price: number | null
  template_lines: Array<Record<string, unknown>>
  notes: string | null
  internal_notes: string | null
  last_generated_through: string | null
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

export async function generateRecurringServiceOccurrences(planId: string, fromDate: string, throughDate: string) {
  const { data, error } = await getClientOrThrow().rpc('generate_recurring_service_occurrences', {
    p_plan_id: planId,
    p_from_date: fromDate,
    p_through_date: throughDate,
  })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudieron generar las visitas.')
  return data as { expected_count: number; created_count: number; existing_count: number; job_ids: string[] }
}

export async function setRecurringServicePlanStatus(planId: string, status: 'active' | 'paused' | 'archived') {
  const { data, error } = await getClientOrThrow().rpc('set_recurring_service_plan_status', { p_plan_id: planId, p_status: status })
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'No se pudo actualizar el plan recurrente.')
  return data as RecurringServicePlan
}

export { getRecurringOccurrenceDates }
