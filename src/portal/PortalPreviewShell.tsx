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
          status: 'ready',
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
      clientDisplayName: 'Cliente de vista previa',
      accountLabel: 'Cuenta de vista previa',
      role: access.membership.role,
      isSynthetic: true,
    },
    dashboard: {
      nextServiceLabel: 'Mañana · 10:00 · Servicio de vista previa',
      openRequestCount: 1,
      availableDocumentCount: 1,
      isSynthetic: true,
    },
    properties: [
      {
        id: 'property-preview-north',
        publicRef: 'ref-espacio-norte',
        displayName: 'Espacio Norte',
        name: 'Espacio Norte',
        propertyType: 'vivienda',
        propertyTypeLabel: 'Vivienda',
        address: 'Calle Marina 12',
        city: 'Barcelona',
        postalCode: '08001',
        status: 'active',
        addressLabel: 'Calle Marina 12 · Barcelona',
        statusLabel: 'Activo · vista previa',
        isSynthetic: true,
      },
      {
        id: 'property-preview-center',
        publicRef: 'ref-espacio-centro',
        displayName: 'Espacio Centro',
        name: 'Espacio Centro',
        propertyType: 'oficina',
        propertyTypeLabel: 'Oficina',
        address: 'Avenida Diagonal 88',
        city: 'Barcelona',
        postalCode: '08018',
        status: 'active',
        addressLabel: 'Avenida Diagonal 88 · Barcelona',
        statusLabel: 'Activo · vista previa',
        isSynthetic: true,
      },
    ],
    services: [
      {
        id: 'service-preview-1',
        serviceLabel: 'Limpieza de mantenimiento',
        propertyLabel: 'Espacio Norte',
        scheduleLabel: 'Mañana · 10:00',
        statusLabel: 'Planificado · vista previa',
        isSynthetic: true,
      },
    ],
    requests: [
      {
        id: 'request-preview-1',
        requestLabel: 'Solicitud de cambio de horario',
        submittedLabel: 'Enviada en la vista previa local',
        statusLabel: 'Pendiente de revisión · vista previa',
        isSynthetic: true,
      },
    ],
    invoices: [
      {
        id: 'invoice-preview-1',
        referenceLabel: 'FACTURA-VISTA-PREVIA-001',
        issuedLabel: 'Documento de vista previa · sin validez fiscal',
        paymentStatusLabel: 'Estado de demostración',
        isSynthetic: true,
      },
    ],
    scenario: 'active_admin',
  })
}
