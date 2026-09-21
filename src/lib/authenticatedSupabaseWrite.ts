import { getSupabaseClient } from './supabase'
import { getSupabasePublicEnv } from './supabaseEnv'

export const AUTHENTICATED_WRITE_SESSION_ERROR =
  'Tu sesion ha caducado o no esta disponible. Inicia sesion de nuevo antes de guardar.'

interface AuthenticatedWriteContextInput {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken: string | null | undefined
}

interface AuthenticatedWriteRequestInput extends AuthenticatedWriteContextInput {
  path: string
  init: RequestInit
}

export interface AuthenticatedWriteContext {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken: string
}

interface AuthenticatedWriteDependencies {
  getContext: () => Promise<AuthenticatedWriteContext>
  refreshContext?: () => Promise<AuthenticatedWriteContext>
  fetch: typeof fetch
}

const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

export function resolveAuthenticatedWriteContext({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
}: AuthenticatedWriteContextInput): AuthenticatedWriteContext {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const normalizedAccessToken = accessToken?.trim()
  if (!normalizedAccessToken || normalizedAccessToken === supabaseAnonKey) {
    throw new Error(AUTHENTICATED_WRITE_SESSION_ERROR)
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    accessToken: normalizedAccessToken,
  }
}

export function buildAuthenticatedSupabaseWriteRequest({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  path,
  init,
}: AuthenticatedWriteRequestInput) {
  const context = resolveAuthenticatedWriteContext({ supabaseUrl, supabaseAnonKey, accessToken })

  return {
    url: `${context.supabaseUrl}/rest/v1/${path}`,
    init: {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        apikey: context.supabaseAnonKey,
        Authorization: `Bearer ${context.accessToken}`,
      },
    },
  }
}

async function getSupabaseSessionContext(refreshSession: boolean): Promise<AuthenticatedWriteContext> {
  const { client, error } = getSupabaseClient()
  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  const sessionResult = refreshSession
    ? await client.auth.refreshSession()
    : await client.auth.getSession()
  const session = sessionResult.data.session

  if (sessionResult.error || !session?.access_token) {
    throw new Error(AUTHENTICATED_WRITE_SESSION_ERROR)
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()
  return resolveAuthenticatedWriteContext({
    supabaseUrl,
    supabaseAnonKey,
    accessToken: session.access_token,
  })
}

async function getAuthenticatedWriteContext(): Promise<AuthenticatedWriteContext> {
  return getSupabaseSessionContext(false)
}

async function refreshAuthenticatedWriteContext(): Promise<AuthenticatedWriteContext> {
  return getSupabaseSessionContext(true)
}

const defaultAuthenticatedWriteDependencies: AuthenticatedWriteDependencies = {
  getContext: getAuthenticatedWriteContext,
  refreshContext: refreshAuthenticatedWriteContext,
  fetch: browserFetch,
}

async function readResponseDetail(response: Response): Promise<string> {
  try {
    const detail = (await response.text()).trim()
    return detail || response.statusText || 'Error desconocido de Supabase.'
  } catch {
    return response.statusText || 'Error desconocido de Supabase.'
  }
}

export async function getAuthenticatedWriteResponseError(response: Response): Promise<Error> {
  const detail = await readResponseDetail(response)

  if (response.status === 401) {
    return new Error(
      `Tu sesion ha caducado o ya no es valida. Inicia sesion de nuevo antes de guardar. REST 401: ${detail}`,
    )
  }

  if (response.status === 403) {
    return new Error(`Tu sesion no tiene permisos para guardar este cambio. REST 403: ${detail}`)
  }

  return new Error(`REST ${response.status}: ${detail}`)
}

export async function readSingleAuthenticatedWriteRow<T>(
  response: Response,
  emptyMessage: string,
): Promise<T> {
  const body = await response.json().catch(() => null)
  const rows = Array.isArray(body) ? body : body ? [body] : []
  if (rows.length !== 1) {
    throw new Error(emptyMessage)
  }
  return rows[0] as T
}

export async function fetchAuthenticatedSupabaseWrite(
  path: string,
  init: RequestInit,
  dependencies: AuthenticatedWriteDependencies = defaultAuthenticatedWriteDependencies,
): Promise<Response> {
  let context = await dependencies.getContext()
  let request = buildAuthenticatedSupabaseWriteRequest({ ...context, path, init })
  let response = await dependencies.fetch(request.url, request.init)

  if (response.status === 401 && dependencies.refreshContext) {
    context = await dependencies.refreshContext()
    request = buildAuthenticatedSupabaseWriteRequest({ ...context, path, init })
    response = await dependencies.fetch(request.url, request.init)
  }

  if (!response.ok) {
    throw await getAuthenticatedWriteResponseError(response)
  }

  return response
}

export const __authenticatedSupabaseWriteTestUtils = {
  browserFetch,
}
