import { getSupabasePublicEnv } from './supabaseEnv'

export class SupabaseRestError extends Error {
  path: string
  status: number

  constructor(path: string, status: number, detail: string) {
    super(`REST ${status}: ${detail}`)
    this.name = 'SupabaseRestError'
    this.path = path
    this.status = status
  }
}

function getRestConfig() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  return { supabaseUrl, supabaseAnonKey }
}

interface FetchSupabaseRestListOptions {
  accessToken?: string | null
}

export async function fetchSupabaseRestListDetailed<T>(
  path: string,
  options: FetchSupabaseRestListOptions = {},
): Promise<{ rows: T[]; status: number }> {
  const { supabaseUrl, supabaseAnonKey } = getRestConfig()
  const bearerToken = options.accessToken?.trim() || supabaseAnonKey
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${bearerToken}` },
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

    throw new SupabaseRestError(path, response.status, detail)
  }

  return {
    rows: ((await response.json()) as T[]) ?? [],
    status: response.status,
  }
}

export async function fetchSupabaseRestList<T>(
  path: string,
  options: FetchSupabaseRestListOptions = {},
): Promise<T[]> {
  const { rows } = await fetchSupabaseRestListDetailed<T>(path, options)
  return rows
}
