import { getSupabaseClient } from '../../lib/supabase'
import type { JobProfitability } from './jobProfitability'

function clientOrThrow() {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  return client
}

export async function getJobProfitability(jobId: string) {
  const { data, error } = await clientOrThrow().rpc('get_job_final_profitability', { p_job_id: jobId })
  if (error) throw error
  return data as JobProfitability
}

export async function listJobProfitability(fromDate: string, throughDate: string) {
  const { data, error } = await clientOrThrow().rpc('list_job_final_profitability', { p_from_date: fromDate, p_through_date: throughDate })
  if (error) throw error
  return (data ?? []) as JobProfitability[]
}
