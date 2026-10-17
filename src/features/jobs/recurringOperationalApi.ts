import { getSupabaseClient } from '../../lib/supabase'
import type { RecurringMaterialTemplate, RecurringTeamTemplate } from './recurringOperational'

export interface OperationalRecurringPlan {
  id: string
  title: string
  billing_quantity: number | null
  billing_unit_price: number | null
  team_templates: RecurringTeamTemplate[]
  material_templates: RecurringMaterialTemplate[]
}

function clientOrThrow() { const { client, error } = getSupabaseClient(); if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.'); return client }

export async function listOperationalRecurringPlans() { const { data, error } = await clientOrThrow().rpc('list_recurring_service_operational_plans'); if (error) throw error; return (data ?? []) as OperationalRecurringPlan[] }
export async function saveRecurringOperationalTemplate(planId: string, team: RecurringTeamTemplate[], materials: RecurringMaterialTemplate[]) { const { data, error } = await clientOrThrow().rpc('save_recurring_service_operational_template', { p_plan_id: planId, p_team: team, p_materials: materials }); if (error || !data) throw error ?? new Error('No se pudo guardar la plantilla operativa.'); return data }
export async function getOperationalForecast(fromDate: string, throughDate: string) { const { data, error } = await clientOrThrow().rpc('get_recurring_operational_forecast', { p_from_date: fromDate, p_through_date: throughDate }); if (error) throw error; return data }
export async function getMaterialNeedsForecast(throughDate: string) { const { data, error } = await clientOrThrow().rpc('get_material_needs_forecast', { p_through_date: throughDate }); if (error) throw error; return data }
export async function getTeamWorkloadForecast(throughDate: string) { const { data, error } = await clientOrThrow().rpc('get_team_workload_forecast', { p_through_date: throughDate }); if (error) throw error; return data }
