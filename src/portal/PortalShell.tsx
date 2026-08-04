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
  | { status: 'unavailable'; data: PortalFoundationData }
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
        setLoadState({
          status: 'unavailable',
          data: {
            account: {
              clientContextId: access.selectedClientId,
              clientDisplayName: 'Área de clientes Costa Clean',
              accountLabel: 'Lectura segura pendiente',
              role: access.membership.role,
              isSynthetic: false,
            },
            dashboard: {
              nextServiceLabel: 'Sin próximo servicio confirmado',
              openRequestCount: 0,
              availableDocumentCount: 0,
              isSynthetic: false,
            },
            profile: {
              fullName: 'Datos de perfil no disponibles todavía',
              phone: 'Pendiente de lectura segura',
              email: 'Pendiente de lectura segura',
              taxId: 'Pendiente de lectura segura',
              billingAddress: 'Pendiente de lectura segura',
              fullNameLabel: 'Datos de perfil no disponibles todavía',
              phoneLabel: 'Pendiente de lectura segura',
              emailLabel: 'Pendiente de lectura segura',
              taxIdLabel: 'Pendiente de lectura segura',
              billingAddressLabel: 'Pendiente de lectura segura',
              reviewStateLabel: 'Lectura segura pendiente',
              isSynthetic: false,
            },
            propertyDetail: null,
            properties: [],
            services: [],
            requests: [],
            invoices: [],
            profileRequests: [],
            propertyRequests: [],
          },
        })
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
