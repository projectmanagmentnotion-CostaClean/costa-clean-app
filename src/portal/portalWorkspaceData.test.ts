import { describe, expect, it } from 'vitest'
import type {
  PortalAccountContext,
  PortalDashboardSnapshot,
  PortalInvoiceSummary,
  PortalPreviewScenario,
  PortalPropertySummary,
  PortalServiceRequestSummary,
  PortalServiceSummary,
} from './contracts'
import { createFallbackPortalFoundationData, createPreviewPortalFoundationData } from './portalWorkspaceData'

const account: PortalAccountContext = {
  clientContextId: 'client-demo',
  clientDisplayName: 'Cliente demostración',
  accountLabel: 'Cuenta sintética',
  role: 'client_admin',
  isSynthetic: true,
}

const dashboard: PortalDashboardSnapshot = {
  nextServiceLabel: 'Mañana · 10:00',
  openRequestCount: 1,
  availableDocumentCount: 2,
  isSynthetic: true,
}

const properties: PortalPropertySummary[] = [
  {
    id: 'property-1',
    displayName: 'Espacio Demo Norte',
    addressLabel: 'Dirección sintética · Barcelona',
    statusLabel: 'Activo · vista previa',
    isSynthetic: true,
  },
]

const services: PortalServiceSummary[] = [
  {
    id: 'service-1',
    serviceLabel: 'Limpieza de mantenimiento · demo',
    propertyLabel: 'Espacio Demo Norte',
    scheduleLabel: 'Mañana · 10:00',
    statusLabel: 'Planificado · sintético',
    isSynthetic: true,
  },
]

const requests: PortalServiceRequestSummary[] = [
  {
    id: 'request-1',
    requestLabel: 'Solicitud de cambio de horario · demo',
    submittedLabel: 'Enviada en la vista previa local',
    statusLabel: 'Pendiente de revisión · sintético',
    isSynthetic: true,
  },
]

const invoices: PortalInvoiceSummary[] = [
  {
    id: 'invoice-1',
    referenceLabel: 'DEMO-FACTURA-001',
    issuedLabel: 'Documento sintético · sin validez fiscal',
    paymentStatusLabel: 'Estado de demostración',
    isSynthetic: true,
  },
]

describe('portal workspace data', () => {
  it('creates a safe fallback workspace without synthetic identifiers', () => {
    const data = createFallbackPortalFoundationData({
      status: 'active_member',
      selectedClientId: 'client-demo',
      membership: {
        clientId: 'client-demo',
        membershipId: 'membership-demo',
        role: 'client_member',
        status: 'active',
      },
    })

    expect(data.properties).toEqual([])
    expect(data.profileRequests).toEqual([])
    expect(data.propertyRequests).toEqual([])
    expect(data.profile.fullNameLabel).toContain('no disponibles')
  })

  it('builds empty preview data for the empty scenario', () => {
    const data = createPreviewPortalFoundationData({
      account,
      dashboard,
      properties,
      services,
      requests,
      invoices,
      scenario: 'empty',
    })

    expect(data.properties).toEqual([])
    expect(data.services).toEqual([])
    expect(data.requests).toEqual([])
    expect(data.invoices).toEqual([])
    expect(data.dashboard.openRequestCount).toBe(0)
    expect(data.dashboard.availableDocumentCount).toBe(0)
  })

  it('shapes reviewed-change previews for profile and property success states', () => {
    const profileSuccess = createPreviewPortalFoundationData({
      account,
      dashboard,
      properties,
      services,
      requests,
      invoices,
      scenario: 'profile_request_success' as PortalPreviewScenario,
    })

    const propertySuccess = createPreviewPortalFoundationData({
      account,
      dashboard,
      properties,
      services,
      requests,
      invoices,
      scenario: 'property_request_success' as PortalPreviewScenario,
    })

    expect(profileSuccess.profileRequests[0]?.statusLabel).toBe('Enviado')
    expect(propertySuccess.propertyRequests[0]?.statusLabel).toBe('Enviado')
  })
})
