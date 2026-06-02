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
    let detail = response.statusText

    try {
      const rawBody = await response.text()
      if (rawBody.trim()) {
        try {
          const parsedBody = JSON.parse(rawBody) as { message?: string; details?: string; hint?: string }
          detail = [parsedBody.message, parsedBody.details, parsedBody.hint]
            .filter((part) => typeof part === 'string' && part.trim().length > 0)
            .join(' | ') || rawBody
        } catch {
          detail = rawBody
        }
      }
    } catch {
      detail = response.statusText
    }

    throw new Error(`REST ${response.status}: ${detail}`)
  }

  return ((await response.json()) as T[]) ?? []
}
