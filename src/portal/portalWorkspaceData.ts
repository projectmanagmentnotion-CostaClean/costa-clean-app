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
import type { PortalAccessState } from './accessMachine'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalProfileSnapshot {
  fullNameLabel: string
  phoneLabel: string
  emailLabel: string
  taxIdLabel: string
  billingAddressLabel: string
  reviewStateLabel: string
  isSynthetic: boolean
}

export interface PortalPropertyDetail {
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
  referenceLabel: string
  scopeLabel: string
  fieldSummaryLabel: string
  submittedLabel: string
  statusLabel: string
  isSynthetic: boolean
}

export interface PortalFoundationData {
  account: PortalAccountContext
  dashboard: PortalDashboardSnapshot
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
  access: AuthenticatedPortalAccess,
): PortalFoundationData {
  const roleLabel = getRoleLabel(access.membership.role)

  return {
    account: {
      clientContextId: access.selectedClientId,
      clientDisplayName: 'Cuenta pendiente de lectura segura',
      accountLabel: 'Área de clientes',
      role: access.membership.role,
      isSynthetic: false,
    },
    dashboard: {
      nextServiceLabel: 'Sin próximo servicio confirmado',
      openRequestCount: 0,
      availableDocumentCount: 0,
      isSynthetic: false,
    },
    profile: {
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

function buildProfileSnapshot(
  account: PortalAccountContext,
  scenario: PortalPreviewScenario | null,
): PortalProfileSnapshot {
  const baseFullName = account.clientDisplayName
  const roleLabel = getRoleLabel(account.role)
  const isEmptyScenario = scenario === 'empty'

  return {
    fullNameLabel: isEmptyScenario ? 'Sin datos sintéticos de perfil' : baseFullName,
    phoneLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : '+34 600 123 456',
    emailLabel: isEmptyScenario ? 'No disponible en la vista previa vacía' : 'cliente@demostracion.costaclean',
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
    publicRefLabel: 'CC-PT-01',
    nameLabel: property.displayName,
    propertyTypeLabel: 'Vivienda gestionada',
    addressLabel: property.addressLabel,
    cityLabel: 'Barcelona',
    postalCodeLabel: '08001',
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

  const stateByScenario: Record<Exclude<PortalPreviewScenario, 'empty'>, string> = {
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
  }

  return [
    {
      referenceLabel: 'CC-PR-0142',
      scopeLabel: 'Perfil',
      fieldSummaryLabel: 'Nombre, teléfono y dirección de facturación',
      submittedLabel: 'Solicitud sintética',
      statusLabel: stateByScenario[scenario ?? 'pending_review'] ?? 'En revisión',
      isSynthetic: true,
    },
  ]
}

function buildPropertyRequests(
  scenario: PortalPreviewScenario | null,
  property: PortalPropertySummary | null,
): PortalReviewedChangeRequestSummary[] {
  if (!property || scenario === 'empty') return []

  const stateByScenario: Record<Exclude<PortalPreviewScenario, 'empty'>, string> = {
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
  }

  return [
    {
      referenceLabel: 'CC-PT-0318',
      scopeLabel: 'Propiedad',
      fieldSummaryLabel: 'Nombre, tipo, dirección, ciudad y código postal',
      submittedLabel: property.displayName,
      statusLabel: stateByScenario[scenario ?? 'pending_review'] ?? 'En revisión',
      isSynthetic: true,
    },
  ]
}

function getRoleLabel(role: PortalMembershipRole): string {
  return role === 'client_admin'
    ? 'Administrador del cliente'
    : 'Miembro del cliente'
}
