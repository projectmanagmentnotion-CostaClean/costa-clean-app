import type { PortalAccessResolution } from './contracts'

export type PortalAccessState =
  | { status: 'booting' }
  | PortalAccessResolution
  | { status: 'error'; message: string }

export type PortalAccessEvent =
  | { type: 'BOOTSTRAP_STARTED' }
  | { type: 'ACCESS_RESOLVED'; resolution: PortalAccessResolution }
  | { type: 'BOOTSTRAP_FAILED' }

export const initialPortalAccessState: PortalAccessState = { status: 'booting' }

export function reducePortalAccessState(
  _currentState: PortalAccessState,
  event: PortalAccessEvent,
): PortalAccessState {
  if (event.type === 'BOOTSTRAP_STARTED') {
    return initialPortalAccessState
  }

  if (event.type === 'ACCESS_RESOLVED') {
    return event.resolution
  }

  return {
    status: 'error',
    message: 'No hemos podido preparar el área de clientes. Inténtalo de nuevo más tarde.',
  }
}
