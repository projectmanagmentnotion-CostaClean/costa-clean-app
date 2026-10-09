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

export interface FetchSupabaseRestListOptions {
  accessToken?: string | null
  range?: { from: number; to: number }
}

const restListPageSize = 500

function stabilizeRestListOrder(path: string): string {
  const url = new URL(path, 'https://rest.invalid')
  const selectedColumns = url.searchParams.get('select')?.split(',').map((column) => column.trim()) ?? []
  const order = url.searchParams.get('order')
  if (!order || !selectedColumns.includes('id') || /(?:^|,)\s*id\.(?:asc|desc)(?:,|$)/i.test(order)) return path

  url.searchParams.set('order', `${order},id.asc`)
  return `${url.pathname.slice(1)}${url.search}`
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

export interface AuthenticatedReadDependencies {
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
      ...(options.range ? {
        'Range-Unit': 'items',
        Range: `${options.range.from}-${options.range.to}`,
      } : {}),
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
  dependencies: AuthenticatedReadDependencies = {
    getContext: getAuthenticatedReadContext,
    fetch: (input, init) => fetch(input, init),
  },
): Promise<T[]> {
  const rows: T[] = []
  const seenIds = new Set<string>()
  const stablePath = stabilizeRestListOrder(path)
  let from = 0
  let previousPageFingerprint: string | null = null

  while (true) {
    const page = await fetchSupabaseRestListDetailed<T>(stablePath, {
      ...options,
      range: { from, to: from + restListPageSize - 1 },
    }, dependencies)
    const pageFingerprint = JSON.stringify(page.rows)
    if (page.rows.length === restListPageSize && pageFingerprint === previousPageFingerprint) {
      throw new Error(`La paginación REST no avanzó al cargar ${path}.`)
    }

    for (const row of page.rows) {
      const id = row && typeof row === 'object' ? (row as { id?: unknown }).id : undefined
      if (typeof id === 'string') {
        if (seenIds.has(id)) continue
        seenIds.add(id)
      }
      rows.push(row)
    }

    if (page.rows.length < restListPageSize) return rows

    previousPageFingerprint = pageFingerprint
    from += restListPageSize
  }
}
