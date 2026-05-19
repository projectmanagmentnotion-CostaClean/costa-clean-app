import { getSupabasePublicEnv } from './supabaseEnv'

function getRestConfig() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  return { supabaseUrl, supabaseAnonKey }
}

export async function fetchSupabaseRestList<T>(path: string): Promise<T[]> {
  const { supabaseUrl, supabaseAnonKey } = getRestConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
  })

  if (!response.ok) {
    throw new Error(`REST ${response.status}: ${response.statusText}`)
  }

  return ((await response.json()) as T[]) ?? []
}
