import { getSupabasePublicEnv } from './supabaseEnv'
import { getSupabaseClient } from './supabase'

export const AUTHENTICATED_READ_SESSION_ERROR =
  'Tu sesion ha caducado o no esta disponible. Inicia sesion de nuevo para cargar los datos.'

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

interface AuthenticatedReadContextInput {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken: string | null | undefined
}

export interface AuthenticatedReadContext {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken: string
}

interface AuthenticatedReadDependencies {
  getContext: () => Promise<AuthenticatedReadContext>
  fetch: typeof fetch
}

export function resolveAuthenticatedReadContext({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
}: AuthenticatedReadContextInput): AuthenticatedReadContext {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const normalizedAccessToken = accessToken?.trim()
  if (!normalizedAccessToken || normalizedAccessToken === supabaseAnonKey) {
    throw new Error(AUTHENTICATED_READ_SESSION_ERROR)
  }

  return { supabaseUrl, supabaseAnonKey, accessToken: normalizedAccessToken }
}

export async function getAuthenticatedReadContext(): Promise<AuthenticatedReadContext> {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error(AUTHENTICATED_READ_SESSION_ERROR)
  }

  const { supabaseUrl, supabaseAnonKey } = getRestConfig()
  return resolveAuthenticatedReadContext({
    supabaseUrl,
    supabaseAnonKey,
    accessToken: session.access_token,
  })
}

export async function fetchSupabaseRestListDetailed<T>(
  path: string,
  options: FetchSupabaseRestListOptions = {},
  dependencies: AuthenticatedReadDependencies = {
    getContext: getAuthenticatedReadContext,
    fetch: (input, init) => fetch(input, init),
  },
): Promise<{ rows: T[]; status: number }> {
  const context = options.accessToken
    ? resolveAuthenticatedReadContext({ ...getRestConfig(), accessToken: options.accessToken })
    : await dependencies.getContext()
  const response = await dependencies.fetch(`${context.supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: context.supabaseAnonKey,
      Authorization: `Bearer ${context.accessToken}`,
    },
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
