export type PortalMembershipRole = 'client_admin' | 'client_member'

export type PortalAccessResolution =
  | { status: 'unauthenticated' }
  | { status: 'pending_review' }
  | { status: 'authenticated'; clientContextId: string; role: PortalMembershipRole }
  | { status: 'suspended' }
  | { status: 'revoked' }
  | { status: 'forbidden' }

export interface PortalAccessAdapter {
  resolveAccess(): Promise<PortalAccessResolution>
}

export interface PortalAccountContext {
  clientContextId: string
  clientDisplayName: string
  accountLabel: string
  role: PortalMembershipRole
  isSynthetic: boolean
}

export interface PortalDashboardSnapshot {
  nextServiceLabel: string
  openRequestCount: number
  availableDocumentCount: number
  isSynthetic: boolean
}

export interface PortalPropertySummary {
  id: string
  displayName: string
  addressLabel: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalServiceSummary {
  id: string
  serviceLabel: string
  propertyLabel: string
  scheduleLabel: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalServiceRequestSummary {
  id: string
  requestLabel: string
  submittedLabel: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalInvoiceSummary {
  id: string
  referenceLabel: string
  issuedLabel: string
  paymentStatusLabel: string
  isSynthetic: boolean
}

export interface PortalReadAdapter {
  getAccountContext(): Promise<PortalAccountContext>
  getDashboard(): Promise<PortalDashboardSnapshot>
  listProperties(): Promise<PortalPropertySummary[]>
  listServices(): Promise<PortalServiceSummary[]>
  listServiceRequests(): Promise<PortalServiceRequestSummary[]>
  listInvoices(): Promise<PortalInvoiceSummary[]>
}

export interface PortalRuntimeAdapter {
  access: PortalAccessAdapter
  reads: PortalReadAdapter
  previewScenario: PortalPreviewScenario | null
}

export const portalPreviewScenarios = [
  'loading',
  'unauthenticated',
  'pending_review',
  'authenticated',
  'suspended',
  'revoked',
  'forbidden',
  'error',
] as const

export type PortalPreviewScenario = (typeof portalPreviewScenarios)[number]
