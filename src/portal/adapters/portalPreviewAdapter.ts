import {
  portalPreviewScenarios,
  type PortalPreviewScenario,
  type PortalRuntimeAdapter,
} from '../contracts'

const previewScenarioSet = new Set<PortalPreviewScenario>(portalPreviewScenarios)

export function readPortalPreviewScenario(search: string): PortalPreviewScenario {
  const requestedScenario = new URLSearchParams(search).get('portalPreview')

  return requestedScenario && previewScenarioSet.has(requestedScenario as PortalPreviewScenario)
    ? requestedScenario as PortalPreviewScenario
    : 'unauthenticated'
}

export function createPortalPreviewAdapter(scenario: PortalPreviewScenario): PortalRuntimeAdapter {
  return {
    access: {
      resolveAccess: async () => {
        if (scenario === 'loading') {
          return new Promise(() => undefined)
        }

        if (scenario === 'error') {
          throw new Error('Synthetic preview failure')
        }

        if (scenario === 'authenticated') {
          return {
            status: 'authenticated',
            clientContextId: 'client-demo-cp3a',
            role: 'client_admin',
          }
        }

        return { status: scenario }
      },
    },
    reads: {
      getAccountContext: async () => ({
        clientContextId: 'client-demo-cp3a',
        clientDisplayName: 'Cliente demostración CP-3A',
        accountLabel: 'Cuenta sintética',
        role: 'client_admin',
        isSynthetic: true,
      }),
      getDashboard: async () => ({
        nextServiceLabel: 'Mañana · 10:00 · Servicio de demostración',
        openRequestCount: 1,
        availableDocumentCount: 1,
        isSynthetic: true,
      }),
      listProperties: async () => [
        {
          id: 'property-demo-cp3a-a',
          displayName: 'Espacio Demo Norte',
          addressLabel: 'Dirección sintética · Barcelona',
          statusLabel: 'Activo · vista previa',
          isSynthetic: true,
        },
        {
          id: 'property-demo-cp3a-b',
          displayName: 'Espacio Demo Centro',
          addressLabel: 'Ubicación sintética · Barcelona',
          statusLabel: 'Activo · vista previa',
          isSynthetic: true,
        },
      ],
      listServices: async () => [
        {
          id: 'service-demo-cp3a-a',
          serviceLabel: 'Limpieza de mantenimiento · demo',
          propertyLabel: 'Espacio Demo Norte',
          scheduleLabel: 'Mañana · 10:00',
          statusLabel: 'Planificado · sintético',
          isSynthetic: true,
        },
        {
          id: 'service-demo-cp3a-b',
          serviceLabel: 'Servicio puntual · demo',
          propertyLabel: 'Espacio Demo Centro',
          scheduleLabel: 'Próxima semana',
          statusLabel: 'Pendiente de revisión · sintético',
          isSynthetic: true,
        },
      ],
      listServiceRequests: async () => [
        {
          id: 'request-demo-cp3a-a',
          requestLabel: 'Solicitud de cambio de horario · demo',
          submittedLabel: 'Enviada en la vista previa local',
          statusLabel: 'Pendiente de revisión · sintético',
          isSynthetic: true,
        },
      ],
      listInvoices: async () => [
        {
          id: 'invoice-demo-cp3a-a',
          referenceLabel: 'DEMO-FACTURA-001',
          issuedLabel: 'Documento sintético · sin validez fiscal',
          paymentStatusLabel: 'Estado de demostración',
          isSynthetic: true,
        },
      ],
    },
    previewScenario: scenario,
  }
}
