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
    reference: 'JOB-PREV-001',
    referenceLabel: 'JOB-PREV-001',
    serviceType: 'regular_cleaning',
    serviceTypeLabel: 'Limpieza regular',
    propertyPublicRef: 'ref-espacio-norte',
    propertyLabel: 'Espacio Norte',
    propertyAddressLabel: 'Calle Marina 12 · Barcelona',
    scheduledDate: '2026-08-06',
    scheduleLabel: '2026-08-06',
    status: 'scheduled',
    statusLabel: 'Programado · vista previa',
    isSynthetic: true,
  },
]

const requests: PortalServiceRequestSummary[] = [
  {
    reference: 'CC-SR-PREV-001',
    referenceLabel: 'CC-SR-PREV-001',
    propertyPublicRef: 'ref-espacio-norte',
    propertyLabel: 'Espacio Norte',
    propertyAddressLabel: 'Calle Marina 12 · Barcelona',
    serviceType: 'regular_cleaning',
    serviceTypeLabel: 'Limpieza regular',
    preferredDate: '2026-08-08',
    preferredDateLabel: '2026-08-08',
    preferredTimeWindow: 'morning',
    preferredTimeWindowLabel: 'Mañana',
    requestedAt: '2026-08-05T08:30:00Z',
    requestedAtLabel: 'Enviada en la vista previa local',
    resolvedAt: null,
    resolvedAtLabel: null,
    notes: 'Solicitud de ejemplo',
    notesLabel: 'Solicitud de ejemplo',
    status: 'pending_review',
    statusLabel: 'Pendiente de revisión · vista previa',
    canCancel: true,
    version: 1,
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
