import type { PortalAccessState } from './accessMachine'
import { PortalWorkspaceView } from './PortalWorkspaceView'
import { createFallbackPortalFoundationData } from './portalWorkspaceData'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalShellProps {
  access: AuthenticatedPortalAccess
  onSignOut: () => void
}

export function PortalShell({ access, onSignOut }: PortalShellProps) {
  return (
    <PortalWorkspaceView
      access={access}
      dataState={{
        status: 'unavailable',
        data: createFallbackPortalFoundationData(access),
      }}
      previewScenario={null}
      onSignOut={onSignOut}
    />
  )
}
