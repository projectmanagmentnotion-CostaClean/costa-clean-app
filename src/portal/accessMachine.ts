import type {
  PortalLifecycleResolution,
  PortalMembershipContext,
} from './contracts'

export type PortalAccessState = PortalLifecycleResolution

export type PortalAccessEvent =
  | { type: 'LIFECYCLE_RESOLVED'; resolution: PortalLifecycleResolution }
  | { type: 'CLIENT_SELECTED'; membership: PortalMembershipContext }

export const initialPortalAccessState: PortalAccessState = { status: 'booting' }

export function reducePortalAccessState(
  currentState: PortalAccessState,
  event: PortalAccessEvent,
): PortalAccessState {
  if (event.type === 'LIFECYCLE_RESOLVED') {
    return event.resolution
  }

  if (currentState.status !== 'client_selection_required') {
    return currentState
  }

  const membership = currentState.memberships.find(
    (candidate) =>
      candidate.clientId === event.membership.clientId
      && candidate.membershipId === event.membership.membershipId
      && candidate.role === event.membership.role
      && candidate.status === 'active',
  )

  if (!membership) {
    return {
      status: 'error',
      message: 'No hemos podido confirmar esa cuenta. Vuelve a intentarlo.',
    }
  }

  return {
    status: 'active_member',
    selectedClientId: membership.clientId,
    membership,
  }
}
