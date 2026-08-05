import { useCallback, useEffect, useState } from 'react'
import type { PortalAccessState } from './accessMachine'
import { PortalWorkspaceView } from './PortalWorkspaceView'
import { loadPortalFoundationData } from './portalReadApi'
import type { PortalFoundationData } from './portalWorkspaceData'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalShellProps {
  access: AuthenticatedPortalAccess
  onSignOut: () => void
}

type PortalLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: PortalFoundationData }
  | { status: 'error' }

export function PortalShell({ access, onSignOut }: PortalShellProps) {
  const [loadState, setLoadState] = useState<PortalLoadState>({ status: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const pathname = window.location.pathname

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    let isCurrent = true

    loadPortalFoundationData(
      {
        clientContextId: access.selectedClientId,
        role: access.membership.role,
      },
      pathname,
    )
      .then((data) => {
        if (!isCurrent) return
        setLoadState({ status: 'ready', data })
      })
      .catch(() => {
        if (!isCurrent) return
        setLoadState({ status: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [access.membership.role, access.selectedClientId, pathname, reloadToken])

  return (
    <PortalWorkspaceView
      access={access}
      dataState={loadState}
      previewScenario={null}
      onSignOut={onSignOut}
      onRefreshData={refresh}
    />
  )
}
