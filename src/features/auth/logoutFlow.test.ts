import { describe, expect, it } from 'vitest'
import { createLogoutFlow } from './logoutFlow'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

describe('createLogoutFlow', () => {
  it('signs out once, exposes pending state, and clears authenticated state only after success', async () => {
    const deferred = createDeferred<{ error: null }>()
    let signOutCalls = 0
    let signedOutCalls = 0
    const pendingChanges: boolean[] = []
    const signOut = () => {
      signOutCalls += 1
      return deferred.promise
    }
    const onPendingChange = (isPending: boolean) => pendingChanges.push(isPending)
    const onSignedOut = () => {
      signedOutCalls += 1
    }
    const runLogout = createLogoutFlow({ signOut, onPendingChange, onSignedOut })

    const firstAttempt = runLogout()
    const duplicateAttempt = await runLogout()

    expect(signOutCalls).toBe(1)
    expect(duplicateAttempt).toBe('already-pending')
    expect(JSON.stringify(pendingChanges)).toBe(JSON.stringify([true]))
    expect(signedOutCalls).toBe(0)

    deferred.resolve({ error: null })

    expect(await firstAttempt).toBe('signed-out')
    expect(signedOutCalls).toBe(1)
    expect(JSON.stringify(pendingChanges)).toBe(JSON.stringify([true, false]))
  })

  it('preserves authenticated state on a provider failure and permits a retry', async () => {
    let signOutCalls = 0
    let signedOutCalls = 0
    const pendingChanges: boolean[] = []
    const signOut = async () => {
      signOutCalls += 1
      return signOutCalls === 1
        ? { error: new Error('provider detail must remain private') }
        : { error: null }
    }
    const onPendingChange = (isPending: boolean) => pendingChanges.push(isPending)
    const onSignedOut = () => {
      signedOutCalls += 1
    }
    const runLogout = createLogoutFlow({ signOut, onPendingChange, onSignedOut })

    expect(await runLogout()).toBe('failed')
    expect(signedOutCalls).toBe(0)

    expect(await runLogout()).toBe('signed-out')
    expect(signOutCalls).toBe(2)
    expect(signedOutCalls).toBe(1)
    expect(JSON.stringify(pendingChanges)).toBe(JSON.stringify([true, false, true, false]))
  })

  it('converts thrown provider failures into a detail-free result', async () => {
    const runLogout = createLogoutFlow({
      signOut: async () => {
        throw new Error('sensitive internal detail')
      },
      onPendingChange: () => undefined,
      onSignedOut: () => undefined,
    })

    expect(await runLogout()).toBe('failed')
  })
})
