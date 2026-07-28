import type {
  PortalAccessResolution,
  PortalMembershipContext,
  PortalMembershipRole,
} from '../contracts'

const selfAccessKeys = [
  'applicationStatus',
  'memberships',
  'selectedClientId',
  'state',
] as const
const membershipKeys = ['clientId', 'membershipId', 'role', 'status'] as const
const states = new Set([
  'active_member',
  'client_selection_required',
  'pending_review',
  'suspended',
  'revoked',
  'authenticated_without_access',
])
const roles = new Set<PortalMembershipRole>(['client_admin', 'client_member'])
const applicationStatuses = new Set([
  'pending_review',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
])
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort()
  const sortedExpected = [...expectedKeys].sort()
  return actualKeys.length === sortedExpected.length
    && actualKeys.every((key, index) => key === sortedExpected[index])
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && value === value.trim()
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    })
}

function parseMembership(value: unknown): PortalMembershipContext {
  if (!isPlainObject(value) || !hasExactKeys(value, membershipKeys)) {
    throw new Error('portal_access_context_invalid')
  }

  if (
    !isSafeIdentifier(value.clientId)
    || typeof value.membershipId !== 'string'
    || !uuidPattern.test(value.membershipId)
    || !roles.has(value.role as PortalMembershipRole)
    || value.status !== 'active'
  ) {
    throw new Error('portal_access_context_invalid')
  }

  return {
    clientId: value.clientId,
    membershipId: value.membershipId,
    role: value.role as PortalMembershipRole,
    status: 'active',
  }
}

function parseMemberships(value: unknown): PortalMembershipContext[] {
  if (!Array.isArray(value)) {
    throw new Error('portal_access_context_invalid')
  }

  const memberships = value.map(parseMembership)
  const clientIds = new Set<string>()
  const membershipIds = new Set<string>()

  for (let index = 0; index < memberships.length; index += 1) {
    const membership = memberships[index]
    if (!membership) throw new Error('portal_access_context_invalid')
    if (clientIds.has(membership.clientId) || membershipIds.has(membership.membershipId)) {
      throw new Error('portal_access_context_invalid')
    }
    if (
      index > 0
      && memberships[index - 1]
      && memberships[index - 1].clientId.localeCompare(membership.clientId) >= 0
    ) {
      throw new Error('portal_access_context_invalid')
    }
    clientIds.add(membership.clientId)
    membershipIds.add(membership.membershipId)
  }

  return memberships
}

export function parsePortalSelfAccessContext(value: unknown): PortalAccessResolution {
  if (!isPlainObject(value) || !hasExactKeys(value, selfAccessKeys)) {
    throw new Error('portal_access_context_invalid')
  }

  if (typeof value.state !== 'string' || !states.has(value.state)) {
    throw new Error('portal_access_context_invalid')
  }
  if (
    value.applicationStatus !== null
    && (
      typeof value.applicationStatus !== 'string'
      || !applicationStatuses.has(value.applicationStatus)
    )
  ) {
    throw new Error('portal_access_context_invalid')
  }

  const memberships = parseMemberships(value.memberships)
  const selectedClientId = value.selectedClientId
  if (selectedClientId !== null && !isSafeIdentifier(selectedClientId)) {
    throw new Error('portal_access_context_invalid')
  }

  if (value.state === 'active_member') {
    const membership = memberships[0]
    if (
      memberships.length !== 1
      || !membership
      || selectedClientId !== membership.clientId
    ) {
      throw new Error('portal_access_context_invalid')
    }
    return {
      status: 'active_member',
      selectedClientId,
      membership,
    }
  }

  if (value.state === 'client_selection_required') {
    if (selectedClientId !== null || memberships.length < 2) {
      throw new Error('portal_access_context_invalid')
    }
    return {
      status: 'client_selection_required',
      memberships,
    }
  }

  if (selectedClientId !== null || memberships.length !== 0) {
    throw new Error('portal_access_context_invalid')
  }
  if (
    (value.state === 'pending_review' && value.applicationStatus !== 'pending_review')
    || (
      value.state === 'authenticated_without_access'
      && value.applicationStatus === 'pending_review'
    )
  ) {
    throw new Error('portal_access_context_invalid')
  }

  return {
    status: value.state as
      | 'pending_review'
      | 'suspended'
      | 'revoked'
      | 'authenticated_without_access',
  }
}
