import { describe, expect, it } from 'vitest'
import { createPortalSupabaseAuthProvider } from './portalFoundationAdapter'
import { createPortalOAuthRedirect } from './portalSupabaseClient'

const validSelfContext = {
  applicationStatus: null,
  memberships: [
    {
      clientId: 'CLIENT-A',
      membershipId: '10000000-0000-4000-8000-000000000001',
      role: 'client_admin',
      status: 'active',
    },
  ],
  selectedClientId: 'CLIENT-A',
  state: 'active_member',
}

interface CreateClientOptions {
  rpcData?: unknown
  signInError?: {
    message: string
    status: number
  } | null
  oauthError?: {
    message: string
    status: number
  } | null
}

function createClient(options: CreateClientOptions = {}) {
  const rpcCalls: unknown[][] = []
  const oauthCalls: unknown[] = []
  let authListener:
    | ((
        event: string,
        session: { user?: { id?: string } } | null,
      ) => void)
    | null = null
  let unsubscribeCalls = 0

  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-a' } } },
        error: null,
      }),
      onAuthStateChange: (
        listener: (
          event: string,
          session: { user?: { id?: string } } | null,
        ) => void,
      ) => {
        authListener = listener
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribeCalls += 1
              },
            },
          },
        }
      },
      resetPasswordForEmail: async () => ({ error: null }),
      signInWithPassword: async () => ({
        error: options.signInError ?? null,
      }),
      signInWithOAuth: async (value: unknown) => {
        oauthCalls.push(value)
        return {
        error: options.oauthError ?? null,
        }
      },
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
    async rpc(...args: unknown[]) {
      rpcCalls.push(args)
      return {
        data: options.rpcData ?? validSelfContext,
        error: null,
      }
    },
  }

  return {
    client,
    emitAuth(
      event: string,
      session: { user?: { id?: string } } | null,
    ) {
      authListener?.(event, session)
    },
    getRpcCalls: () => rpcCalls,
    getOauthCalls: () => oauthCalls,
    getUnsubscribeCalls: () => unsubscribeCalls,
  }
}

describe('portal Supabase Auth/RPC provider', () => {
  it('uses only the zero-parameter self-access RPC and validates its DTO', async () => {
    const { client, getRpcCalls } = createClient()
    const provider = createPortalSupabaseAuthProvider(client)

    const result = await provider.resolveSelfAccess()

    expect(getRpcCalls()).toEqual([['portal_resolve_self_access_context']])
    expect(result).toEqual({
      ok: true,
      value: {
        status: 'active_member',
        selectedClientId: 'CLIENT-A',
        membership: validSelfContext.memberships[0],
      },
    })
  })

  it('fails closed when the RPC returns an unknown DTO', async () => {
    const { client } = createClient({
      rpcData: { ...validSelfContext, unexpected: true },
    })
    const provider = createPortalSupabaseAuthProvider(client)

    expect(await provider.resolveSelfAccess()).toEqual({
      ok: false,
      reason: 'unknown',
    })
  })

  it('maps sessions without exposing tokens and unsubscribes cleanly', async () => {
    const testClient = createClient()
    const provider = createPortalSupabaseAuthProvider(testClient.client)

    expect(await provider.getSession()).toEqual({
      ok: true,
      value: { userId: 'user-a' },
    })

    const listenerCalls: unknown[][] = []
    const stop = provider.onAuthStateChange((...args) => {
      listenerCalls.push(args)
    })
    testClient.emitAuth('TOKEN_REFRESHED', {
      user: { id: 'user-b' },
    })

    expect(listenerCalls).toEqual([
      ['TOKEN_REFRESHED', { userId: 'user-b' }],
    ])
    stop()
    expect(testClient.getUnsubscribeCalls()).toBe(1)
  })

  it('normalizes provider errors to safe failure categories', async () => {
    const { client } = createClient({
      signInError: {
        message: 'Invalid login credentials for real-person@example.com',
        status: 400,
      },
    })
    const provider = createPortalSupabaseAuthProvider(client)

    expect(
      await provider.signIn('synthetic@example.invalid', 'incorrect'),
    ).toEqual({
      ok: false,
      reason: 'unknown',
    })
  })

  it('builds the exact portal callback without adding OAuth scopes', () => {
    expect(createPortalOAuthRedirect('http://127.0.0.1:4174')).toBe(
      'http://127.0.0.1:4174/portal',
    )
    expect(createPortalOAuthRedirect('https://app.costacleanbcn.com')).toBe(
      'https://app.costacleanbcn.com/portal',
    )
    expect(createPortalOAuthRedirect('https://app.costacleanbcn.com/portal?next=x')).toBeNull()
  })

  it('delegates Google sign-in to Supabase with only the portal callback', async () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'http://127.0.0.1:4174' } },
    })

    try {
      const testClient = createClient()
      const provider = createPortalSupabaseAuthProvider(testClient.client)

      expect(await provider.signInWithGoogle()).toEqual({ ok: true, value: null })
      expect(testClient.getOauthCalls()).toEqual([{
        provider: 'google',
        options: { redirectTo: 'http://127.0.0.1:4174/portal' },
      }])
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window')
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        })
      }
    }
  })
})
