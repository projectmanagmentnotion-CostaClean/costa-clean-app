import { getSupabaseClient } from './supabase'

function getRestConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  return { supabaseUrl, supabaseAnonKey }
}

async function getAuthorizationToken(supabaseAnonKey: string): Promise<string> {
  const { client } = getSupabaseClient()
  const {
    data: { session },
  } = client ? await client.auth.getSession() : { data: { session: null } }

  return session?.access_token ?? supabaseAnonKey
}

export async function fetchSupabaseRestList<T>(path: string): Promise<T[]> {
  const { supabaseUrl, supabaseAnonKey } = getRestConfig()
  const authorizationToken = await getAuthorizationToken(supabaseAnonKey)
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${authorizationToken}` },
  })

  if (!response.ok) {
    throw new Error(`REST ${response.status}: ${response.statusText}`)
  }

  return ((await response.json()) as T[]) ?? []
}
