import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv } from '../../lib/supabaseEnv'

const portalStoragePrefix = 'costa-clean-portal'
const portalAuthLockQueue = new Map<string, Promise<void>>()

let portalSupabaseClient: SupabaseClient | null = null
let portalSupabaseClientUrl: string | null = null

async function withPortalAuthLock<Result>(
  name: string,
  _acquireTimeout: number,
  operation: () => Promise<Result>,
): Promise<Result> {
  const previousLock = portalAuthLockQueue.get(name) ?? Promise.resolve()
  let releaseLock!: () => void

  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  const queueTail = previousLock.then(() => currentLock)
  portalAuthLockQueue.set(name, queueTail)

  await previousLock

  try {
    return await operation()
  } finally {
    releaseLock()

    if (portalAuthLockQueue.get(name) === queueTail) {
      portalAuthLockQueue.delete(name)
    }
  }
}

function normalizePortalHost(supabaseUrl: string): string | null {
  try {
    const url = new URL(supabaseUrl)
    const isLocalDevelopment =
      url.protocol === 'http:'
      && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !isLocalDevelopment) || !url.hostname) {
      return null
    }

    const hostWithPort = url.port ? `${url.hostname}-${url.port}` : url.hostname
    return hostWithPort.toLowerCase().replace(/[^a-z0-9.-]/gu, '-')
  } catch {
    return null
  }
}

export function createPortalAuthStorageKey(supabaseUrl: string): string | null {
  const host = normalizePortalHost(supabaseUrl)
  return host ? `${portalStoragePrefix}-${host}-auth` : null
}

export function createPortalRecoveryRedirect(origin: string): string | null {
  try {
    const url = new URL(origin)
    const isLocalDevelopment =
      url.protocol === 'http:'
      && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)

    if (url.protocol !== 'https:' && !isLocalDevelopment) return null
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      return null
    }

    return new URL('/portal/reset-password', url.origin).toString()
  } catch {
    return null
  }
}

export function getPortalRecoveryRedirect(): string | null {
  if (typeof window === 'undefined') return null
  return createPortalRecoveryRedirect(window.location.origin)
}

export function sanitizePortalRecoveryUrl() {
  if (
    typeof window === 'undefined'
    || window.location.pathname !== '/portal/reset-password'
    || (!window.location.search && !window.location.hash)
  ) {
    return
  }

  window.history.replaceState(null, '', '/portal/reset-password')
}

export function clearStoredPortalSession() {
  if (typeof window === 'undefined') return

  const { supabaseUrl } = getSupabasePublicEnv()
  const storageKey = createPortalAuthStorageKey(supabaseUrl)
  if (!storageKey) return

  try {
    window.localStorage.removeItem(storageKey)
    window.localStorage.removeItem(`${storageKey}-code-verifier`)
    window.localStorage.removeItem(`${storageKey}-user`)
  } catch {
    // The lifecycle still clears protected UI state when browser storage is unavailable.
  }
}

export function getPortalSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()
  const storageKey = createPortalAuthStorageKey(supabaseUrl)

  if (!supabaseUrl || !supabaseAnonKey || !storageKey) {
    return {
      client: null,
      error: 'portal_auth_configuration_unavailable' as const,
    }
  }

  if (!portalSupabaseClient || portalSupabaseClientUrl !== supabaseUrl) {
    portalSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        lock: withPortalAuthLock,
        persistSession: true,
        storageKey,
      },
    })
    portalSupabaseClientUrl = supabaseUrl
  }

  return {
    client: portalSupabaseClient,
    error: null,
  }
}
