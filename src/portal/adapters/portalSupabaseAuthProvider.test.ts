import { describe, expect, it } from 'vitest'
import { createPortalSupabaseAuthProvider } from './portalFoundationAdapter'

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
}

function createClient(options: CreateClientOptions = {}) {
  const rpcCalls: unknown[][] = []
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
})
