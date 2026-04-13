function getRestConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
