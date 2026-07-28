import { describe, expect, it } from 'vitest'
import { parsePortalSelfAccessContext } from './selfAccessContext'

const membership = {
  clientId: 'client-a',
  membershipId: '11111111-1111-4111-8111-111111111111',
  role: 'client_admin',
  status: 'active',
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    applicationStatus: 'approved',
    memberships: [membership],
    selectedClientId: 'client-a',
    state: 'active_member',
    ...overrides,
  }
}

function rejects(value: unknown) {
  let rejected = false
  try {
    parsePortalSelfAccessContext(value)
  } catch {
    rejected = true
  }
  return rejected
}

describe('portal self access context parser', () => {
  it('accepts the exact single-client active-member contract', () => {
    expect(parsePortalSelfAccessContext(context())).toMatchObject({
      status: 'active_member',
      selectedClientId: 'client-a',
    })
  })

  it('accepts sorted multi-client memberships without selecting one', () => {
    expect(parsePortalSelfAccessContext(context({
      memberships: [
        membership,
        {
          clientId: 'client-b',
          membershipId: '22222222-2222-4222-8222-222222222222',
          role: 'client_member',
          status: 'active',
        },
      ],
      selectedClientId: null,
      state: 'client_selection_required',
    })).status).toBe('client_selection_required')
  })

  it('rejects unknown keys, roles, statuses, duplicates and unsafe identifiers', () => {
    expect(rejects({ ...context(), unexpected: true })).toBe(true)
    expect(rejects(context({
      memberships: [{ ...membership, role: 'staff' }],
    }))).toBe(true)
    expect(rejects(context({
      memberships: [{ ...membership, status: 'pending' }],
    }))).toBe(true)
    expect(rejects(context({
      memberships: [membership, membership],
      selectedClientId: null,
      state: 'client_selection_required',
    }))).toBe(true)
    expect(rejects(context({
      memberships: [{ ...membership, clientId: 'client-a\n' }],
      selectedClientId: 'client-a\n',
    }))).toBe(true)
  })

  it('rejects all state and membership cardinality mismatches', () => {
    expect(rejects(context({ selectedClientId: 'client-b' }))).toBe(true)
    expect(rejects(context({
      memberships: [membership],
      selectedClientId: null,
      state: 'client_selection_required',
    }))).toBe(true)
    expect(rejects(context({
      memberships: [membership],
      selectedClientId: null,
      state: 'pending_review',
      applicationStatus: 'pending_review',
    }))).toBe(true)
    expect(rejects(context({
      memberships: [],
      selectedClientId: null,
      state: 'pending_review',
      applicationStatus: 'approved',
    }))).toBe(true)
    expect(rejects(context({
      memberships: [],
      selectedClientId: null,
      state: 'authenticated_without_access',
      applicationStatus: 'pending_review',
    }))).toBe(true)
  })

  it('accepts inactive states only with no selected tenant or membership', () => {
    for (const state of ['suspended', 'revoked', 'authenticated_without_access']) {
      expect(parsePortalSelfAccessContext(context({
        memberships: [],
        selectedClientId: null,
        state,
      })).status).toBe(state)
    }
    expect(parsePortalSelfAccessContext(context({
      applicationStatus: 'pending_review',
      memberships: [],
      selectedClientId: null,
      state: 'pending_review',
    })).status).toBe('pending_review')
  })
})
