export type PortalMembershipRole = 'client_admin' | 'client_member'

export interface PortalMembershipContext {
  clientId: string
  membershipId: string
  role: PortalMembershipRole
  status: 'active'
}

export type PortalAccessResolution =
  | { status: 'unauthenticated' }
  | { status: 'pending_review' }
  | {
      status: 'active_member'
      selectedClientId: string
      membership: PortalMembershipContext
    }
  | {
      status: 'client_selection_required'
      memberships: PortalMembershipContext[]
    }
  | { status: 'suspended' }
  | { status: 'revoked' }
  | { status: 'authenticated_without_access' }

export type PortalLifecycleResolution =
  | PortalAccessResolution
  | { status: 'booting' }
  | { status: 'password_recovery' }
  | { status: 'session_expired' }
  | { status: 'error'; message: string }

export interface PortalAuthActionResult {
  ok: boolean
  message: string
}

export interface PortalLifecycleAdapter {
  start(onResolution: (resolution: PortalLifecycleResolution) => void): () => void
  retry(): void
  signIn(email: string, password: string): Promise<PortalAuthActionResult>
  requestPasswordRecovery(email: string): Promise<PortalAuthActionResult>
  updatePassword(password: string): Promise<PortalAuthActionResult>
  signOut(): Promise<PortalAuthActionResult>
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
  decoratePath(pathname: string): string
  lifecycle: PortalLifecycleAdapter
  reads: PortalReadAdapter | null
  previewScenario: PortalPreviewScenario | null
}

export const portalPreviewScenarios = [
  'loading',
  'login',
  'recovery',
  'reset',
  'active_admin',
  'active_member',
  'multi_client',
  'pending_review',
  'suspended',
  'revoked',
  'without_access',
  'session_expired',
  'offline',
] as const

export type PortalPreviewScenario = (typeof portalPreviewScenarios)[number]
