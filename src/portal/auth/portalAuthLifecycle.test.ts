import { describe, expect, it, vi } from 'vitest'
import type { PortalAccessResolution } from '../contracts'
import {
  createPortalAuthLifecycle,
  type PortalAuthEvent,
  type PortalAuthProvider,
  type PortalProviderResult,
  type PortalSessionSnapshot,
} from './portalAuthLifecycle'

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function eventually(assertion: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (assertion()) return
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  throw new Error('expected_condition_not_reached')
}

interface TestProvider extends PortalAuthProvider {
  emit(
    event: PortalAuthEvent | string,
    session: PortalSessionSnapshot | null,
  ): void
  resolveQueue: Array<
    Promise<PortalProviderResult<PortalAccessResolution>>
  >
  resolveCalls: number
}

function createProvider(
  session: PortalSessionSnapshot | null = null,
): TestProvider {
  let listener:
    | ((
        event: PortalAuthEvent | string,
        nextSession: PortalSessionSnapshot | null,
      ) => void)
    | null = null

  const provider: TestProvider = {
    clearStoredSession: vi.fn(),
    emit(event, nextSession) {
      listener?.(event, nextSession)
    },
    getSession: vi.fn(
      async (): Promise<PortalProviderResult<PortalSessionSnapshot | null>> => ({
        ok: true,
        value: session,
      }),
    ),
    onAuthStateChange: vi.fn((
      nextListener: (
        event: PortalAuthEvent | string,
        nextSession: PortalSessionSnapshot | null,
      ) => void,
    ) => {
      listener = nextListener
      return () => {
        listener = null
      }
    }),
    requestPasswordRecovery: vi.fn(
      async (): Promise<PortalProviderResult<null>> => ({
        ok: true,
        value: null,
      }),
    ),
    resolveCalls: 0,
    resolveQueue: [],
    resolveSelfAccess: vi.fn(async (): Promise<
      PortalProviderResult<PortalAccessResolution>
    > => {
      provider.resolveCalls += 1
      const nextResolution = provider.resolveQueue.shift()
      return nextResolution
        ? await nextResolution
        : {
            ok: true,
            value: { status: 'authenticated_without_access' },
          }
    }),
    sanitizeRecoveryUrl: vi.fn(),
    signIn: vi.fn(async (): Promise<PortalProviderResult<null>> => ({
      ok: true,
      value: null,
    })),
    signOut: vi.fn(async (): Promise<PortalProviderResult<null>> => ({
      ok: true,
      value: null,
    })),
    updatePassword: vi.fn(async (): Promise<PortalProviderResult<null>> => ({
      ok: true,
      value: null,
    })),
  }

  return provider
}

function startLifecycle(provider: TestProvider) {
  const lifecycle = createPortalAuthLifecycle(provider)
  const resolutions: Array<
    PortalAccessResolution['status']
    | 'booting'
    | 'password_recovery'
    | 'session_expired'
    | 'error'
  > = []
  const values: unknown[] = []
  const stop = lifecycle.start((resolution) => {
    resolutions.push(resolution.status)
    values.push(resolution)
  })

  return { lifecycle, resolutions, stop, values }
}

describe('portal Auth lifecycle', () => {
  it('bootstraps a session and resolves access before exposing membership', async () => {
    const provider = createProvider({ userId: 'user-a' })
    provider.resolveQueue.push(Promise.resolve({
      ok: true,
      value: {
        status: 'active_member',
        selectedClientId: 'CLIENT-A',
        membership: {
          clientId: 'CLIENT-A',
          membershipId: '10000000-0000-4000-8000-000000000001',
          role: 'client_admin',
          status: 'active',
        },
      },
    }))
    const { resolutions, stop } = startLifecycle(provider)

    await eventually(() => resolutions.at(-1) === 'active_member')
    expect(resolutions[0]).toBe('booting')
    expect(provider.resolveCalls).toBe(1)
    stop()
  })

  it('discards an out-of-order response after the authenticated user changes', async () => {
    const provider = createProvider({ userId: 'user-a' })
    const first = deferred<PortalProviderResult<PortalAccessResolution>>()
    const second = deferred<PortalProviderResult<PortalAccessResolution>>()
    provider.resolveQueue.push(first.promise, second.promise)
    const { values, stop } = startLifecycle(provider)

    await eventually(
      () => provider.resolveQueue.length === 1,
    )
    provider.emit('SIGNED_IN', { userId: 'user-b' })
    await eventually(
      () => provider.resolveQueue.length === 0,
    )

    second.resolve({
      ok: true,
      value: { status: 'pending_review' },
    })
    await eventually(
      () => (
        typeof values.at(-1) === 'object'
        && values.at(-1) !== null
        && 'status' in (values.at(-1) as Record<string, unknown>)
        && (values.at(-1) as Record<string, unknown>).status === 'pending_review'
      ),
    )

    first.resolve({
      ok: true,
      value: {
        status: 'active_member',
        selectedClientId: 'STALE-CLIENT',
        membership: {
          clientId: 'STALE-CLIENT',
          membershipId: '10000000-0000-4000-8000-000000000001',
          role: 'client_member',
          status: 'active',
        },
      },
    })
    await Promise.resolve()

    expect(values.at(-1)).toEqual({ status: 'pending_review' })
    stop()
  })

  it('re-resolves on token refresh and clears on unexpected sign-out', async () => {
    const provider = createProvider({ userId: 'user-a' })
    const { resolutions, stop } = startLifecycle(provider)

    await eventually(
      () => resolutions.at(-1) === 'authenticated_without_access',
    )
    provider.emit('TOKEN_REFRESHED', { userId: 'user-a' })
    await eventually(() => provider.resolveCalls === 2)
    provider.emit('SIGNED_OUT', null)

    expect(resolutions.at(-1)).toBe('session_expired')
    expect(provider.clearStoredSession).toHaveBeenCalled()
    stop()
  })

  it('re-resolves access after USER_UPDATED without exposing stale content', async () => {
    const provider = createProvider({ userId: 'user-a' })
    const { resolutions, stop } = startLifecycle(provider)

    await eventually(
      () => resolutions.at(-1) === 'authenticated_without_access',
    )
    provider.emit('USER_UPDATED', { userId: 'user-a' })

    await eventually(() => provider.resolveCalls === 2)
    expect(resolutions.slice(-2)).toEqual([
      'booting',
      'authenticated_without_access',
    ])
    stop()
  })

  it('clears protected state during a user-initiated sign-out', async () => {
    const provider = createProvider({ userId: 'user-a' })
    const { lifecycle, resolutions, stop } = startLifecycle(provider)

    await eventually(
      () => resolutions.at(-1) === 'authenticated_without_access',
    )
    const result = await lifecycle.signOut()

    expect(result.ok).toBe(true)
    expect(provider.signOut).toHaveBeenCalledTimes(1)
    expect(provider.clearStoredSession).toHaveBeenCalledTimes(1)
    expect(resolutions.at(-1)).toBe('unauthenticated')
    stop()
  })

  it('treats an authenticated RPC denial as an expired session', async () => {
    const provider = createProvider({ userId: 'user-a' })
    provider.resolveQueue.push(Promise.resolve({
      ok: false,
      reason: 'auth',
    }))
    const { resolutions, stop } = startLifecycle(provider)

    await eventually(() => resolutions.at(-1) === 'session_expired')
    expect(provider.clearStoredSession).toHaveBeenCalledTimes(1)
    stop()
  })

  it('keeps a recovery session out of the access RPC and signs out after update', async () => {
    const provider = createProvider()
    const { lifecycle, resolutions, stop } = startLifecycle(provider)
    await eventually(() => resolutions.at(-1) === 'unauthenticated')

    provider.emit('PASSWORD_RECOVERY', { userId: 'user-recovery' })
    expect(resolutions.at(-1)).toBe('password_recovery')
    await Promise.resolve()
    expect(provider.sanitizeRecoveryUrl).toHaveBeenCalledTimes(1)
    expect(provider.resolveSelfAccess).not.toHaveBeenCalled()

    const result = await lifecycle.updatePassword('synthetic-password')

    expect(result.ok).toBe(true)
    expect(provider.updatePassword).toHaveBeenCalledTimes(1)
    expect(provider.signOut).toHaveBeenCalledTimes(1)
    expect(resolutions.at(-1)).toBe('unauthenticated')
    stop()
  })

  it('blocks duplicate login submits and returns generic credentials copy', async () => {
    const provider = createProvider()
    const signIn = deferred<PortalProviderResult<null>>()
    provider.signIn = vi.fn(async () => await signIn.promise)
    const { lifecycle, stop } = startLifecycle(provider)

    const first = lifecycle.signIn(' synthetic@example.invalid ', 'incorrect')
    const second = await lifecycle.signIn(
      'synthetic@example.invalid',
      'incorrect',
    )

    expect(provider.signIn).toHaveBeenCalledTimes(1)
    expect(second.ok).toBe(false)
    expect(second.message).not.toContain('example')

    signIn.resolve({ ok: false, reason: 'auth' })
    const firstResult = await first
    expect(firstResult).toEqual(second)
    stop()
  })

  it('completes a successful login only after resolving authorized access', async () => {
    const provider = createProvider()
    const { lifecycle, resolutions, values, stop } = startLifecycle(provider)
    await eventually(() => resolutions.at(-1) === 'unauthenticated')

    provider.getSession = vi.fn(
      async (): Promise<PortalProviderResult<PortalSessionSnapshot | null>> => ({
        ok: true,
        value: { userId: 'user-member' },
      }),
    )
    provider.resolveQueue.push(Promise.resolve({
      ok: true,
      value: {
        status: 'active_member',
        selectedClientId: 'CLIENT-MEMBER',
        membership: {
          clientId: 'CLIENT-MEMBER',
          membershipId: '10000000-0000-4000-8000-000000000002',
          role: 'client_member',
          status: 'active',
        },
      },
    }))

    const result = await lifecycle.signIn(
      ' member@example.invalid ',
      'synthetic-password',
    )
    await eventually(() => resolutions.at(-1) === 'active_member')

    expect(result.ok).toBe(true)
    expect(provider.signIn).toHaveBeenCalledWith(
      'member@example.invalid',
      'synthetic-password',
    )
    expect(values.at(-1)).toMatchObject({
      status: 'active_member',
      membership: { role: 'client_member' },
    })
    stop()
  })

  it('recovers safely after a network error and explicit retry', async () => {
    const provider = createProvider({ userId: 'user-a' })
    provider.resolveQueue.push(
      Promise.resolve({ ok: false, reason: 'network' }),
      Promise.resolve({
        ok: true,
        value: { status: 'pending_review' },
      }),
    )
    const { lifecycle, resolutions, stop } = startLifecycle(provider)

    await eventually(() => resolutions.at(-1) === 'error')
    lifecycle.retry()
    await eventually(() => resolutions.at(-1) === 'pending_review')

    expect(provider.resolveCalls).toBe(2)
    stop()
  })

  it('returns the same neutral recovery envelope on provider success or failure', async () => {
    const successProvider = createProvider()
    const failureProvider = createProvider()
    failureProvider.requestPasswordRecovery = vi.fn(
      async (): Promise<PortalProviderResult<null>> => ({
        ok: false,
        reason: 'network',
      }),
    )
    const success = startLifecycle(successProvider)
    const failure = startLifecycle(failureProvider)

    const successResult = await success.lifecycle.requestPasswordRecovery(
      'exists@example.invalid',
    )
    const failureResult = await failure.lifecycle.requestPasswordRecovery(
      'missing@example.invalid',
    )

    expect(successResult).toEqual(failureResult)
    expect(successResult.ok).toBe(true)
    success.stop()
    failure.stop()
  })

  it('fails closed for an unknown Auth event and releases the subscription', async () => {
    const provider = createProvider({ userId: 'user-a' })
    const { resolutions, stop } = startLifecycle(provider)
    await eventually(
      () => resolutions.at(-1) === 'authenticated_without_access',
    )

    provider.emit('FUTURE_UNKNOWN_EVENT', { userId: 'user-a' })
    expect(resolutions.at(-1)).toBe('error')

    stop()
    provider.emit('SIGNED_OUT', null)
    expect(resolutions.at(-1)).toBe('error')
  })
})
