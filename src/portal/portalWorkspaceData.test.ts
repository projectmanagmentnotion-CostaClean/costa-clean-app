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
  clientContextId: 'client-preview',
  clientDisplayName: 'Cliente de vista previa',
  accountLabel: 'Cuenta de vista previa',
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
]

const services: PortalServiceSummary[] = [
  {
    id: 'service-1',
    serviceLabel: 'Limpieza de mantenimiento',
    propertyLabel: 'Espacio Norte',
    scheduleLabel: 'Mañana · 10:00',
    statusLabel: 'Planificado · vista previa',
    isSynthetic: true,
  },
]

const requests: PortalServiceRequestSummary[] = [
  {
    id: 'request-1',
    requestLabel: 'Solicitud de cambio de horario',
    submittedLabel: 'Enviada en la vista previa local',
    statusLabel: 'Pendiente de revisión · vista previa',
    isSynthetic: true,
  },
]

const invoices: PortalInvoiceSummary[] = [
  {
    id: 'invoice-1',
    referenceLabel: 'FACTURA-VISTA-PREVIA-001',
    issuedLabel: 'Documento de vista previa · sin validez fiscal',
    paymentStatusLabel: 'Estado de demostración',
    isSynthetic: true,
  },
]

describe('portal workspace data', () => {
  it('creates a safe fallback workspace without synthetic identifiers', () => {
    const data = createFallbackPortalFoundationData({
      status: 'active_member',
      selectedClientId: 'client-preview',
      membership: {
        clientId: 'client-preview',
        membershipId: 'membership-preview',
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
    expect(propertySuccess.propertyDetail?.publicRef).toBe('ref-espacio-norte')
  })
})
