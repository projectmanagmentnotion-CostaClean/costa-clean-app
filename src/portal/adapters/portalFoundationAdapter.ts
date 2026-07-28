import type { PortalAccessResolution, PortalRuntimeAdapter } from '../contracts'
import {
  createPortalAuthLifecycle,
  type PortalAuthEvent,
  type PortalAuthProvider,
  type PortalProviderFailure,
  type PortalProviderResult,
  type PortalSessionSnapshot,
} from '../auth/portalAuthLifecycle'
import { parsePortalSelfAccessContext } from '../auth/selfAccessContext'
import {
  clearStoredPortalSession,
  getPortalRecoveryRedirect,
  getPortalSupabaseClient,
  sanitizePortalRecoveryUrl,
} from './portalSupabaseClient'

interface PortalSupabaseError {
  message?: string
  name?: string
  status?: number
}

interface PortalSupabaseSession {
  user?: {
    id?: string
  }
}

interface PortalSupabaseClientLike {
  auth: {
    getSession(): Promise<{
      data: { session: PortalSupabaseSession | null }
      error: PortalSupabaseError | null
    }>
    onAuthStateChange(
      listener: (event: string, session: PortalSupabaseSession | null) => void,
    ): {
      data: {
        subscription: {
          unsubscribe(): void
        }
      }
    }
    resetPasswordForEmail(
      email: string,
      options: { redirectTo: string },
    ): Promise<{ error: PortalSupabaseError | null }>
    signInWithPassword(credentials: {
      email: string
      password: string
    }): Promise<{ error: PortalSupabaseError | null }>
    signOut(): Promise<{ error: PortalSupabaseError | null }>
    updateUser(attributes: {
      password: string
    }): Promise<{ error: PortalSupabaseError | null }>
  }
  rpc(
    functionName: 'portal_resolve_self_access_context',
  ): PromiseLike<{
    data: unknown
    error: PortalSupabaseError | null
  }>
}

function classifyProviderFailure(error: PortalSupabaseError): PortalProviderFailure {
  if (error.status === 401 || error.status === 403) return 'auth'

  const safeMessage = `${error.name ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (
    safeMessage.includes('failed to fetch')
    || safeMessage.includes('load failed')
    || safeMessage.includes('network')
    || safeMessage.includes('timeout')
  ) {
    return 'network'
  }

  return 'unknown'
}

function providerFailure(error: PortalSupabaseError): PortalProviderResult<never> {
  return {
    ok: false,
    reason: classifyProviderFailure(error),
  }
}

function mapSession(session: PortalSupabaseSession | null): PortalSessionSnapshot | null {
  const userId = session?.user?.id
  return typeof userId === 'string' && userId.length > 0
    ? { userId }
    : null
}

export function createPortalSupabaseAuthProvider(
  client: PortalSupabaseClientLike,
): PortalAuthProvider {
  return {
    clearStoredSession: clearStoredPortalSession,

    async getSession() {
      try {
        const { data, error } = await client.auth.getSession()
        if (error) return providerFailure(error)
        return { ok: true, value: mapSession(data.session) }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    onAuthStateChange(listener) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
        listener(event as PortalAuthEvent, mapSession(session))
      })

      return () => subscription.unsubscribe()
    },

    async resolveSelfAccess(): Promise<PortalProviderResult<PortalAccessResolution>> {
      try {
        const { data, error } = await client.rpc(
          'portal_resolve_self_access_context',
        )
        if (error) return providerFailure(error)

        try {
          return {
            ok: true,
            value: parsePortalSelfAccessContext(data),
          }
        } catch {
          return { ok: false, reason: 'unknown' }
        }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    async signIn(email, password) {
      try {
        const credentials = { email, password }
        const { error } = await client.auth.signInWithPassword(credentials)
        return error ? providerFailure(error) : { ok: true, value: null }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    async requestPasswordRecovery(email) {
      const redirectTo = getPortalRecoveryRedirect()
      if (!redirectTo) return { ok: false, reason: 'configuration' }

      try {
        const portalAuth = client.auth
        const { error } = await portalAuth.resetPasswordForEmail(email, {
          redirectTo,
        })
        return error ? providerFailure(error) : { ok: true, value: null }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    async updatePassword(password) {
      try {
        const { error } = await client.auth.updateUser({ password })
        return error ? providerFailure(error) : { ok: true, value: null }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut()
        return error ? providerFailure(error) : { ok: true, value: null }
      } catch {
        return { ok: false, reason: 'network' }
      }
    },

    sanitizeRecoveryUrl: sanitizePortalRecoveryUrl,
  }
}

function createUnavailableAuthProvider(): PortalAuthProvider {
  const unavailable = async (): Promise<PortalProviderResult<never>> => ({
    ok: false,
    reason: 'configuration',
  })

  return {
    clearStoredSession: clearStoredPortalSession,
    getSession: unavailable,
    onAuthStateChange: () => () => undefined,
    requestPasswordRecovery: unavailable,
    resolveSelfAccess: unavailable,
    sanitizeRecoveryUrl: sanitizePortalRecoveryUrl,
    signIn: unavailable,
    signOut: unavailable,
    updatePassword: unavailable,
  }
}

interface PortalFoundationAdapterOptions {
  provider?: PortalAuthProvider
}

export function createPortalFoundationAdapter(
  options: PortalFoundationAdapterOptions = {},
): PortalRuntimeAdapter {
  let provider = options.provider

  if (!provider) {
    const { client } = getPortalSupabaseClient()
    provider = client
      ? createPortalSupabaseAuthProvider(
          client as unknown as PortalSupabaseClientLike,
        )
      : createUnavailableAuthProvider()
  }

  return {
    decoratePath: (pathname) => pathname,
    lifecycle: createPortalAuthLifecycle(provider),
    reads: null,
    previewScenario: null,
  }
}
