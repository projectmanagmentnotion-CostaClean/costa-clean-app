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
  publicRef: string
  displayName: string
  name: string
  propertyType: string
  address: string
  city: string
  postalCode: string
  status: string
  propertyTypeLabel: string
  addressLabel: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalServiceSummary {
  reference: string
  referenceLabel: string
  serviceType: string
  serviceTypeLabel: string
  propertyPublicRef: string
  propertyLabel: string
  propertyAddressLabel: string
  scheduledDate: string
  scheduleLabel: string
  status: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalServiceRequestSummary {
  reference: string
  referenceLabel: string
  propertyPublicRef: string
  propertyLabel: string
  propertyAddressLabel: string
  serviceType: string
  serviceTypeLabel: string
  preferredDate: string
  preferredDateLabel: string
  preferredTimeWindow: string
  preferredTimeWindowLabel: string
  requestedAt: string
  requestedAtLabel: string
  resolvedAt: string | null
  resolvedAtLabel: string | null
  notes: string
  notesLabel: string
  status: string
  statusLabel: string
  canCancel: boolean
  version: number
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
  submitServiceRequest(input: PortalServiceRequestSubmissionInput): Promise<PortalServiceRequestReceipt>
  cancelServiceRequest(input: PortalServiceRequestCancellationInput): Promise<PortalServiceRequestReceipt>
}

export interface PortalServiceRequestSubmissionInput {
  clientId: string
  propertyPublicRef: string
  serviceType: string
  preferredDate: string
  preferredTimeWindow: string
  notes: string
  idempotencyKey: string
}

export interface PortalServiceRequestCancellationInput {
  clientId: string
  reference: string
  version: number
}

export interface PortalServiceRequestReceipt {
  reference: string
  status: string
  requestedAt: string
  resolvedAt: string | null
  propertyPublicRef: string
  propertyLabel: string
  serviceType: string
  serviceTypeLabel: string
  preferredDate: string
  preferredDateLabel: string
  preferredTimeWindow: string
  preferredTimeWindowLabel: string
  notes: string
  notesLabel: string
  version: number
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
  'empty',
  'profile_request_success',
  'profile_retry',
  'profile_conflict',
  'property_unavailable',
  'property_request_success',
  'services_loading',
  'services_empty',
  'services_error',
  'next_service',
  'service_history',
  'service_unavailable',
  'request_draft',
  'request_review',
  'request_success',
  'request_retry',
  'request_conflict',
  'request_cancelled',
  'request_not_cancellable',
] as const

export type PortalPreviewScenario = (typeof portalPreviewScenarios)[number]
