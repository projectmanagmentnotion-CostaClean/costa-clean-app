import { describe, expect, it } from 'vitest'
import {
  initialPortalAccessState,
  reducePortalAccessState,
  type PortalAccessState,
} from './accessMachine'
import type {
  PortalLifecycleResolution,
  PortalMembershipContext,
} from './contracts'

const membership: PortalMembershipContext = {
  clientId: 'client-a',
  membershipId: '11111111-1111-4111-8111-111111111111',
  role: 'client_member',
  status: 'active',
}

describe('portal access state machine', () => {
  it('starts in a dedicated booting state', () => {
    expect(initialPortalAccessState.status).toBe('booting')
  })

  it('resolves every explicit lifecycle state without inferring tenancy', () => {
    const resolutions: PortalLifecycleResolution[] = [
      { status: 'unauthenticated' },
      { status: 'password_recovery' },
      { status: 'pending_review' },
      {
        status: 'active_member',
        selectedClientId: membership.clientId,
        membership,
      },
      {
        status: 'client_selection_required',
        memberships: [
          membership,
          {
            clientId: 'client-b',
            membershipId: '22222222-2222-4222-8222-222222222222',
            role: 'client_admin',
            status: 'active',
          },
        ],
      },
      { status: 'suspended' },
      { status: 'revoked' },
      { status: 'authenticated_without_access' },
      { status: 'session_expired' },
      { status: 'error', message: 'Error seguro.' },
    ]

    for (const resolution of resolutions) {
      const nextState = reducePortalAccessState(initialPortalAccessState, {
        type: 'LIFECYCLE_RESOLVED',
        resolution,
      })
      expect(nextState.status).toBe(resolution.status)
    }
  })

  it('selects only an exact membership returned by the RPC', () => {
    const state: PortalAccessState = {
      status: 'client_selection_required',
      memberships: [
        membership,
        {
          clientId: 'client-b',
          membershipId: '22222222-2222-4222-8222-222222222222',
          role: 'client_admin',
          status: 'active',
        },
      ],
    }

    expect(reducePortalAccessState(state, {
      type: 'CLIENT_SELECTED',
      membership,
    })).toMatchObject({
      status: 'active_member',
      selectedClientId: 'client-a',
    })

    expect(reducePortalAccessState(state, {
      type: 'CLIENT_SELECTED',
      membership: { ...membership, clientId: 'client-unknown' },
    }).status).toBe('error')
  })

  it('never accepts client selection outside the multi-client state', () => {
    const state: PortalAccessState = { status: 'pending_review' }
    expect(reducePortalAccessState(state, {
      type: 'CLIENT_SELECTED',
      membership,
    })).toBe(state)
  })
})
