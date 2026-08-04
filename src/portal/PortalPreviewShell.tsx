import { useEffect, useState } from 'react'
import type { PortalAccessState } from './accessMachine'
import type {
  PortalPreviewScenario,
  PortalReadAdapter,
} from './contracts'
import { PortalWorkspaceView, type PortalWorkspaceDataState } from './PortalWorkspaceView'
import { createPreviewPortalFoundationData, type PortalFoundationData } from './portalWorkspaceData'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalPreviewShellProps {
  access: AuthenticatedPortalAccess
  reads: PortalReadAdapter | null
  previewScenario: PortalPreviewScenario | null
  onSignOut: () => void
}

export function PortalPreviewShell({
  access,
  reads,
  previewScenario,
  onSignOut,
}: PortalPreviewShellProps) {
  const [dataState, setDataState] = useState<PortalWorkspaceDataState>(
    reads
      ? { status: 'loading' }
      : {
          status: 'unavailable',
          data: createFallbackPreviewData(access),
        },
  )

  useEffect(() => {
    if (!reads) return

    let isCurrent = true

    Promise.all([
      reads.getAccountContext(),
      reads.getDashboard(),
      reads.listProperties(),
      reads.listServices(),
      reads.listServiceRequests(),
      reads.listInvoices(),
    ])
      .then(([account, dashboard, properties, services, requests, invoices]) => {
        if (!isCurrent) return
        if (
          account.clientContextId !== access.selectedClientId
          || account.role !== access.membership.role
        ) {
          setDataState({ status: 'error' })
          return
        }

        setDataState({
          status: 'ready',
          data: createPreviewPortalFoundationData({
            account,
            dashboard,
            properties,
            services,
            requests,
            invoices,
            scenario: previewScenario,
          }),
        })
      })
      .catch(() => {
        if (isCurrent) setDataState({ status: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [access.membership.role, access.selectedClientId, previewScenario, reads])

  return (
    <PortalWorkspaceView
      access={access}
      dataState={dataState}
      previewScenario={previewScenario}
      onSignOut={onSignOut}
    />
  )
}

function createFallbackPreviewData(access: AuthenticatedPortalAccess): PortalFoundationData {
  return createPreviewPortalFoundationData({
    account: {
      clientContextId: access.selectedClientId,
      clientDisplayName: 'Cliente demostración CP-3B.2',
      accountLabel: 'Cuenta sintética',
      role: access.membership.role,
      isSynthetic: true,
    },
    dashboard: {
      nextServiceLabel: 'Mañana · 10:00 · Servicio de demostración',
      openRequestCount: 1,
      availableDocumentCount: 1,
      isSynthetic: true,
    },
    properties: [
      {
        id: 'property-demo-cp3b2-a',
        displayName: 'Espacio Demo Norte',
        addressLabel: 'Dirección sintética · Barcelona',
        statusLabel: 'Activo · vista previa',
        isSynthetic: true,
      },
      {
        id: 'property-demo-cp3b2-b',
        displayName: 'Espacio Demo Centro',
        addressLabel: 'Ubicación sintética · Barcelona',
        statusLabel: 'Activo · vista previa',
        isSynthetic: true,
      },
    ],
    services: [
      {
        id: 'service-demo-cp3b2-a',
        serviceLabel: 'Limpieza de mantenimiento · demo',
        propertyLabel: 'Espacio Demo Norte',
        scheduleLabel: 'Mañana · 10:00',
        statusLabel: 'Planificado · sintético',
        isSynthetic: true,
      },
    ],
    requests: [
      {
        id: 'request-demo-cp3b2-a',
        requestLabel: 'Solicitud de cambio de horario · demo',
        submittedLabel: 'Enviada en la vista previa local',
        statusLabel: 'Pendiente de revisión · sintético',
        isSynthetic: true,
      },
    ],
    invoices: [
      {
        id: 'invoice-demo-cp3b2-a',
        referenceLabel: 'DEMO-FACTURA-001',
        issuedLabel: 'Documento sintético · sin validez fiscal',
        paymentStatusLabel: 'Estado de demostración',
        isSynthetic: true,
      },
    ],
    scenario: 'active_admin',
  })
}
