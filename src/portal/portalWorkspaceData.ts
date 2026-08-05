import type {
  PortalAccountContext,
  PortalDashboardSnapshot,
  PortalInvoiceSummary,
  PortalPreviewScenario,
  PortalPropertySummary,
  PortalServiceRequestSummary,
  PortalServiceSummary,
  PortalMembershipRole,
} from './contracts'

export type PortalCapabilityStatus = 'REAL' | 'UNAVAILABLE' | 'ERROR'

export interface PortalCapabilitySnapshot {
  status: PortalCapabilityStatus
  message?: string
}

export interface PortalCapabilityMap {
  account: PortalCapabilitySnapshot
  profile: PortalCapabilitySnapshot
  properties: PortalCapabilitySnapshot
  profileRequests: PortalCapabilitySnapshot
  propertyRequests: PortalCapabilitySnapshot
  services: PortalCapabilitySnapshot
  serviceRequests: PortalCapabilitySnapshot
  invoices: PortalCapabilitySnapshot
}

export interface PortalProfileSnapshot {
  fullName: string
  phone: string
  email: string
  taxId: string
  billingAddress: string
  fullNameLabel: string
  phoneLabel: string
  emailLabel: string
  taxIdLabel: string
  billingAddressLabel: string
  reviewStateLabel: string
  isSynthetic: boolean
}

export interface PortalPropertyDetail {
  id: string
  publicRef: string
  name: string
  propertyType: string
  address: string
  city: string
  postalCode: string
  status: string
  publicRefLabel: string
  nameLabel: string
  propertyTypeLabel: string
  addressLabel: string
  cityLabel: string
  postalCodeLabel: string
  reviewStateLabel: string
  isSynthetic: boolean
}

export interface PortalReviewedChangeRequestSummary {
  reference: string
  referenceLabel: string
  scopeLabel: string
  fieldSummaryLabel: string
  submittedLabel: string
  statusLabel: string
  requestedAt: string
  resolvedAt: string | null
  changedFields: string[]
  requestType: 'profile' | 'property'
  isSynthetic: boolean
}

export interface PortalFoundationData {
  account: PortalAccountContext
  dashboard: PortalDashboardSnapshot
  capabilities: PortalCapabilityMap
  profile: PortalProfileSnapshot
  propertyDetail: PortalPropertyDetail | null
  properties: PortalPropertySummary[]
  services: PortalServiceSummary[]
  requests: PortalServiceRequestSummary[]
  invoices: PortalInvoiceSummary[]
  profileRequests: PortalReviewedChangeRequestSummary[]
  propertyRequests: PortalReviewedChangeRequestSummary[]
}

export interface PortalPreviewContentInput {
  account: PortalAccountContext
  dashboard: PortalDashboardSnapshot
  properties: PortalPropertySummary[]
  services: PortalServiceSummary[]
  requests: PortalServiceRequestSummary[]
  invoices: PortalInvoiceSummary[]
  scenario: PortalPreviewScenario | null
}

export function createFallbackPortalFoundationData(
  access: {
    status?: string
    clientContextId?: string
    selectedClientId?: string
    role?: PortalMembershipRole
    membership?: { role: PortalMembershipRole } & Record<string, unknown>
  },
): PortalFoundationData {
  const role = access.membership?.role ?? access.role ?? 'client_member'
  const clientContextId = access.selectedClientId ?? access.clientContextId ?? ''
  const roleLabel = getRoleLabel(role)

  return {
    account: {
      clientContextId,
      clientDisplayName: 'Área de clientes Costa Clean',
      accountLabel: 'Acceso seguro',
      role,
      isSynthetic: false,
    },
    dashboard: {
      nextServiceLabel: 'Sin próximo servicio confirmado',
      openRequestCount: 0,
      availableDocumentCount: 0,
      isSynthetic: false,
    },
    capabilities: buildUnavailableCapabilityMap('Lectura segura pendiente'),
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
      reviewStateLabel: `Acceso activo · ${roleLabel}`,
      isSynthetic: false,
    },
    propertyDetail: null,
    properties: [],
    services: [],
    requests: [],
    invoices: [],
    profileRequests: [],
    propertyRequests: [],
  }
}

export function createPreviewPortalFoundationData(
  input: PortalPreviewContentInput,
): PortalFoundationData {
  const { account, dashboard, properties, services, requests, invoices, scenario } = input
  const isEmptyScenario = scenario === 'empty'
  const safeProperties = isEmptyScenario ? [] : properties
  const selectedProperty = safeProperties[0] ?? null

  return {
    account,
    dashboard: isEmptyScenario
      ? {
          ...dashboard,
          nextServiceLabel: 'No hay próximos servicios en esta vista previa',
          openRequestCount: 0,
          availableDocumentCount: 0,
        }
      : dashboard,
    capabilities: buildPreviewCapabilityMap(scenario, isEmptyScenario),
    profile: buildProfileSnapshot(account, scenario),
    propertyDetail: selectedProperty ? buildPropertyDetail(selectedProperty, scenario) : null,
    properties: safeProperties,
    services: isEmptyScenario ? [] : services,
    requests: isEmptyScenario ? [] : requests,
    invoices: isEmptyScenario ? [] : invoices,
    profileRequests: buildProfileRequests(scenario),
    propertyRequests: buildPropertyRequests(scenario, selectedProperty),
  }
}

export function buildUnavailableCapabilityMap(message: string): PortalCapabilityMap {
  return {
    account: { status: 'UNAVAILABLE', message },
    profile: { status: 'UNAVAILABLE', message },
    properties: { status: 'UNAVAILABLE', message },
    profileRequests: { status: 'UNAVAILABLE', message },
    propertyRequests: { status: 'UNAVAILABLE', message },
    services: { status: 'UNAVAILABLE', message },
    serviceRequests: { status: 'UNAVAILABLE', message },
    invoices: { status: 'UNAVAILABLE', message },
  }
}

function buildPreviewCapabilityMap(
  scenario: PortalPreviewScenario | null,
  isEmptyScenario: boolean,
): PortalCapabilityMap {
  const message = isEmptyScenario ? 'Vista previa vacía' : 'Vista previa sintética'
  const status: PortalCapabilityStatus = scenario === 'offline' ? 'ERROR' : 'REAL'
  return {
    account: { status },
    profile: { status, message },
    properties: { status, message },
    profileRequests: { status, message },
    propertyRequests: { status, message },
    services: { status, message },
    serviceRequests: { status, message },
    invoices: { status, message },
  }
}

function buildProfileSnapshot(
  account: PortalAccountContext,
  scenario: PortalPreviewScenario | null,
): PortalProfileSnapshot {
  const baseFullName = account.clientDisplayName
  const roleLabel = getRoleLabel(account.role)
  const isEmptyScenario = scenario === 'empty'

  return {
    fullName: isEmptyScenario ? 'Sin datos de perfil en vista previa' : baseFullName,
    phone: isEmptyScenario ? 'No disponible en la vista previa vacía' : '+34 600 123 456',
    email: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'cliente@vista-previa.costaclean',
    taxId: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'B12345678',
    billingAddress: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'Av. Marina 12 · Barcelona',
    fullNameLabel: isEmptyScenario ? 'Sin datos de perfil en vista previa' : baseFullName,
    phoneLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : '+34 600 123 456',
    emailLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'cliente@vista-previa.costaclean',
    taxIdLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'B12345678',
    billingAddressLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'Av. Marina 12 · Barcelona',
    reviewStateLabel: isEmptyScenario
      ? 'Sin solicitudes activas'
      : `Acceso explícito · ${roleLabel}`,
    isSynthetic: true,
  }
}

function buildPropertyDetail(
  property: PortalPropertySummary,
  scenario: PortalPreviewScenario | null,
): PortalPropertyDetail {
  const isUnavailable = scenario === 'property_unavailable'
  return {
    id: property.id,
    publicRef: property.publicRef,
    name: property.displayName,
    propertyType: property.propertyType,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode,
    status: property.status,
    publicRefLabel: property.publicRef.toUpperCase(),
    nameLabel: property.displayName,
    propertyTypeLabel: property.propertyTypeLabel,
    addressLabel: property.addressLabel,
    cityLabel: property.city,
    postalCodeLabel: property.postalCode,
    reviewStateLabel: isUnavailable
      ? 'Esta propiedad no está disponible.'
      : property.statusLabel,
    isSynthetic: true,
  }
}

function buildProfileRequests(
  scenario: PortalPreviewScenario | null,
): PortalReviewedChangeRequestSummary[] {
  if (scenario === 'empty') return []

  const stateByScenario: Record<PortalPreviewScenario, string> = {
    empty: 'Pendiente',
    loading: 'Pendiente',
    login: 'Pendiente',
    recovery: 'Pendiente',
    reset: 'Pendiente',
    active_admin: 'En revisión',
    active_member: 'En revisión',
    multi_client: 'En revisión',
    pending_review: 'En revisión',
    suspended: 'En pausa',
    revoked: 'Revocado',
    without_access: 'Sin acceso',
    session_expired: 'Sesión cerrada',
    offline: 'Sin conexión',
    profile_request_success: 'Enviado',
    profile_retry: 'Reintento listo',
    profile_conflict: 'Conflicto neutral',
    property_unavailable: 'No disponible',
    property_request_success: 'Enviado',
    services_loading: 'Pendiente',
    services_empty: 'Pendiente',
    services_error: 'Pendiente',
    next_service: 'Pendiente',
    service_history: 'Pendiente',
    service_unavailable: 'No disponible',
    request_draft: 'Pendiente',
    request_review: 'En revisión',
    request_success: 'Enviado',
    request_retry: 'Reintento listo',
    request_conflict: 'Conflicto neutral',
    request_cancelled: 'Cancelada',
    request_not_cancellable: 'Bloqueada',
  }

  return [
    {
      reference: 'CC-PR-0142',
      referenceLabel: 'CC-PR-0142',
      scopeLabel: 'Perfil',
      fieldSummaryLabel: 'Nombre, teléfono y dirección de facturación',
      submittedLabel: 'Solicitud de vista previa',
      statusLabel: stateByScenario[scenario ?? 'pending_review'] ?? 'En revisión',
      requestedAt: '2026-07-31T09:00:00Z',
      resolvedAt: null,
      changedFields: ['fullName', 'phone', 'billingAddress'],
      requestType: 'profile',
      isSynthetic: true,
    },
  ]
}

function buildPropertyRequests(
  scenario: PortalPreviewScenario | null,
  property: PortalPropertySummary | null,
): PortalReviewedChangeRequestSummary[] {
  if (!property || scenario === 'empty') return [] 

  const stateByScenario: Record<PortalPreviewScenario, string> = {
    empty: 'Pendiente',
    loading: 'Pendiente',
    login: 'Pendiente',
    recovery: 'Pendiente',
    reset: 'Pendiente',
    active_admin: 'En revisión',
    active_member: 'En revisión',
    multi_client: 'En revisión',
    pending_review: 'En revisión',
    suspended: 'En pausa',
    revoked: 'Revocado',
    without_access: 'Sin acceso',
    session_expired: 'Sesión cerrada',
    offline: 'Sin conexión',
    profile_request_success: 'Pendiente',
    profile_retry: 'Pendiente',
    profile_conflict: 'Pendiente',
    property_unavailable: 'No disponible',
    property_request_success: 'Enviado',
    services_loading: 'Pendiente',
    services_empty: 'Pendiente',
    services_error: 'Pendiente',
    next_service: 'Pendiente',
    service_history: 'Pendiente',
    service_unavailable: 'No disponible',
    request_draft: 'Pendiente',
    request_review: 'En revisión',
    request_success: 'Enviado',
    request_retry: 'Reintento listo',
    request_conflict: 'Conflicto neutral',
    request_cancelled: 'Cancelada',
    request_not_cancellable: 'Bloqueada',
  }

  return [
    {
      reference: 'CC-PT-0318',
      referenceLabel: 'CC-PT-0318',
      scopeLabel: 'Propiedad',
      fieldSummaryLabel: 'Nombre, tipo, dirección, ciudad y código postal',
      submittedLabel: property.displayName,
      statusLabel: stateByScenario[scenario ?? 'pending_review'] ?? 'En revisión',
      requestedAt: '2026-07-31T09:05:00Z',
      resolvedAt: null,
      changedFields: ['name', 'propertyType', 'address', 'city', 'postalCode'],
      requestType: 'property',
      isSynthetic: true,
    },
  ]
}

function getRoleLabel(role: PortalMembershipRole): string {
  return role === 'client_admin'
    ? 'Administrador del cliente'
    : 'Miembro del cliente'
}
