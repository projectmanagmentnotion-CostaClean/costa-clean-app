import { describe, expect, it } from 'vitest'
import {
  initialPortalAccessState,
  reducePortalAccessState,
  type PortalAccessState,
} from './accessMachine'
import type { PortalAccessResolution } from './contracts'

describe('portal access state machine', () => {
  it('starts in a dedicated booting state', () => {
    expect(initialPortalAccessState.status).toBe('booting')
  })

  it('resolves every explicit state without inferring tenancy', () => {
    const resolutions: PortalAccessResolution[] = [
      { status: 'unauthenticated' },
      { status: 'pending_review' },
      {
        status: 'authenticated',
        clientContextId: 'client-demo-cp3a',
        role: 'client_member',
      },
      { status: 'suspended' },
      { status: 'revoked' },
      { status: 'forbidden' },
    ]
    const currentState: PortalAccessState = { status: 'booting' }

    for (const resolution of resolutions) {
      const nextState = reducePortalAccessState(currentState, {
        type: 'ACCESS_RESOLVED',
        resolution,
      })

      expect(nextState.status).toBe(resolution.status)
    }
  })

  it('keeps authenticated tenancy explicit in the resolution', () => {
    const resolution = {
      status: 'authenticated',
      clientContextId: 'client-demo-cp3a',
      role: 'client_member',
    } as const
    const nextState = reducePortalAccessState(
      { status: 'booting' },
    {
      type: 'ACCESS_RESOLVED',
      resolution,
    },
    )

    expect(nextState).toMatchObject(resolution)
  })

  it('maps bootstrap failures to generic copy without provider details', () => {
    const nextState = reducePortalAccessState(
      { status: 'booting' },
      { type: 'BOOTSTRAP_FAILED' },
    )

    expect(nextState.status).toBe('error')
    expect(nextState).toMatchObject({
      status: 'error',
      message: 'No hemos podido preparar el área de clientes. Inténtalo de nuevo más tarde.',
    })
  })
})
