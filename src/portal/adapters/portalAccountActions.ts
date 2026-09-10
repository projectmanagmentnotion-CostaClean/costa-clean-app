import { getPortalSupabaseClient } from './portalSupabaseClient'

export interface PortalOnboardingInput {
  customerType: 'individual' | 'business'
  firstName: string | null
  lastName: string | null
  legalName: string | null
  tradeName: string | null
  taxId: string | null
  contactPerson: string | null
  contactPhone: string | null
  billingAddress: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  country: string
  marketingOptIn: boolean
  locale: string
  legalAccepted: boolean
  idempotencyKey: string
}

export interface PortalMember {
  membershipId: string
  displayName: string | null
  email: string | null
  role: 'client_admin' | 'client_member'
  status: 'active'
  isSelf: boolean
}

export interface PortalPendingInvitation {
  email: string
  role: 'client_admin' | 'client_member'
  status: 'pending'
  expiresAt: string
  invitationRef: string
}

export interface PortalMarketingPreference {
  enabled: boolean
  status: 'granted' | 'withdrawn'
  version: string | null
  textReference: string | null
  updatedAt: string | null
}

export async function submitPortalApplication(input: PortalOnboardingInput) {
  return invokePortalAction<{ status?: unknown }>('portal-account-actions', {
    action: 'submitApplicationV2',
    ...input,
  }).then((result) => ({
    status: result.status === 'pending_review' ? 'pending_review' as const : 'pending_review' as const,
  }))
}

export async function listPortalMembers(clientId: string): Promise<PortalMember[]> {
  const result = await invokePortalAction<unknown>('portal-member-actions', {
    action: 'listMembers',
    clientId,
  })
  if (!Array.isArray(result)) throw new Error('portal_members_invalid')
  return result.map(readMember)
}

export async function listPortalPendingInvitations(clientId: string): Promise<PortalPendingInvitation[]> {
  const result = await invokePortalAction<unknown>('portal-member-actions', {
    action: 'listPendingInvitations',
    clientId,
  })
  if (!Array.isArray(result)) throw new Error('portal_invitations_invalid')
  return result.map(readPendingInvitation)
}

export async function revokePortalMember(clientId: string, membershipId: string): Promise<void> {
  await invokePortalAction('portal-member-actions', {
    action: 'revokeMember',
    clientId,
    membershipId,
  })
}

export async function getPortalMarketingPreference(clientId: string, locale: string): Promise<PortalMarketingPreference> {
  const result = await invokePortalAction<unknown>('portal-account-actions', {
    action: 'getMarketingPreference',
    clientId,
    locale,
  })
  return readMarketingPreference(result)
}

export async function setPortalMarketingPreference(
  clientId: string,
  enabled: boolean,
  locale: string,
): Promise<PortalMarketingPreference> {
  const result = await invokePortalAction<unknown>('portal-account-actions', {
    action: 'setMarketingPreference',
    clientId,
    enabled,
    locale,
  })
  return readMarketingPreference(result)
}

async function invokePortalAction<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { client, error } = getPortalSupabaseClient()
  if (!client || error) throw new Error('portal_action_unavailable')
  const { data, error: invokeError } = await client.functions.invoke<unknown>(functionName, { body })
  if (invokeError || !data || typeof data !== 'object') throw new Error('portal_action_failed')
  const envelope = data as { ok?: unknown; result?: unknown }
  if (envelope.ok !== true) throw new Error('portal_action_failed')
  return envelope.result as T
}

function readMember(value: unknown): PortalMember {
  const record = objectValue(value)
  const role = record.role === 'client_admin' || record.role === 'client_member' ? record.role : null
  const status = record.status === 'active' ? record.status : null
  if (typeof record.membershipId !== 'string' || !role || !status || typeof record.isSelf !== 'boolean') {
    throw new Error('portal_member_invalid')
  }
  return {
    membershipId: record.membershipId,
    displayName: typeof record.displayName === 'string' ? record.displayName : null,
    email: typeof record.email === 'string' ? record.email : null,
    role,
    status,
    isSelf: record.isSelf,
  }
}

function readPendingInvitation(value: unknown): PortalPendingInvitation {
  const record = objectValue(value)
  const role = record.role === 'client_admin' || record.role === 'client_member' ? record.role : null
  if (typeof record.email !== 'string' || role !== 'client_member' && role !== 'client_admin'
    || record.status !== 'pending' || typeof record.expiresAt !== 'string' || typeof record.invitationRef !== 'string') {
    throw new Error('portal_invitation_invalid')
  }
  return {
    email: record.email,
    role,
    status: 'pending',
    expiresAt: record.expiresAt,
    invitationRef: record.invitationRef,
  }
}

function readMarketingPreference(value: unknown): PortalMarketingPreference {
  const record = objectValue(value)
  if (typeof record.enabled !== 'boolean' || (record.status !== 'granted' && record.status !== 'withdrawn')) {
    throw new Error('portal_marketing_preference_invalid')
  }
  return {
    enabled: record.enabled,
    status: record.status,
    version: typeof record.version === 'string' ? record.version : null,
    textReference: typeof record.textReference === 'string' ? record.textReference : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
