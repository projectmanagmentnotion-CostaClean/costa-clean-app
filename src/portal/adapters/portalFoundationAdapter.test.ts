import { describe, expect, it, vi } from 'vitest'
import type {
  PortalAuthEvent,
  PortalAuthProvider,
} from '../auth/portalAuthLifecycle'
import { createPortalFoundationAdapter } from './portalFoundationAdapter'

async function eventually(assertion: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (assertion()) return
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  throw new Error('expected_condition_not_reached')
}

function createProvider(): PortalAuthProvider {
  return {
    clearStoredSession: vi.fn(),
    getSession: async () => ({ ok: true, value: null }),
    onAuthStateChange: (
      listener: (
        event: PortalAuthEvent | string,
        session: { userId: string } | null,
      ) => void,
    ) => {
      void listener
      return () => undefined
    },
    requestPasswordRecovery: async () => ({ ok: true, value: null }),
    resolveSelfAccess: async () => ({
      ok: true,
      value: { status: 'authenticated_without_access' },
    }),
    sanitizeRecoveryUrl: vi.fn(),
    signIn: async () => ({ ok: true, value: null }),
    signOut: async () => ({ ok: true, value: null }),
    updatePassword: async () => ({ ok: true, value: null }),
  }
}

describe('production portal foundation adapter', () => {
  it('starts with the real lifecycle boundary and no business reads', async () => {
    const adapter = createPortalFoundationAdapter({
      provider: createProvider(),
    })
    const resolutions: string[] = []
    const stop = adapter.lifecycle.start((resolution) => {
      resolutions.push(resolution.status)
    })

    await eventually(() => resolutions.includes('unauthenticated'))

    expect(adapter.reads).toBeNull()
    expect(adapter.previewScenario).toBeNull()
    stop()
  })

  it('exposes only the bounded lifecycle command allowlist', () => {
    const adapter = createPortalFoundationAdapter({
      provider: createProvider(),
    })

    expect(Object.keys(adapter.lifecycle).sort()).toEqual([
      'requestPasswordRecovery',
      'retry',
      'signIn',
      'signOut',
      'start',
      'updatePassword',
    ])
  })
})
