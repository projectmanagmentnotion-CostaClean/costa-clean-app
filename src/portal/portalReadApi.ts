import { getPortalSupabaseClient } from './adapters/portalSupabaseClient'
import {
  resolvePortalPropertyRoute,
  type PortalPropertyRoute,
} from './portalNavigation'
import type {
  PortalAccountContext,
  PortalDashboardSnapshot,
  PortalInvoiceSummary,
  PortalMembershipRole,
  PortalPropertySummary,
  PortalServiceRequestSummary,
  PortalServiceSummary,
} from './contracts'
import type {
  PortalFoundationData,
  PortalProfileSnapshot,
  PortalPropertyDetail,
  PortalReviewedChangeRequestSummary,
} from './portalWorkspaceData'

type JsonRecord = Record<string, unknown>

interface PortalRpcClientLike {
  rpc<T = unknown>(
    functionName: string,
    params?: JsonRecord,
  ): PromiseLike<{
    data: T | null
    error: { message?: string; status?: number } | null
  }>
}

interface PortalRuntimeContext {
  clientContextId: string
  role: PortalMembershipRole
}

export interface PortalReviewedChangeReceipt {
  reference: string
  status: string
  requestedAt: string
  changedFields: string[]
  requestType: 'profile' | 'property'
}

export async function loadPortalFoundationData(
  access: PortalRuntimeContext,
  pathname: string,
): Promise<PortalFoundationData> {
  const client = getPortalRpcClient()
  const [profile, properties, services, serviceRequests, invoices, profileRequests] =
    await Promise.all([
      readPortalProfile(client, access.clientContextId),
      readPortalProperties(client, access.clientContextId),
      readPortalServices(client, access.clientContextId),
      readPortalServiceRequests(client, access.clientContextId),
      readPortalInvoices(client, access.clientContextId),
      readPortalProfileRequests(client, access.clientContextId),
    ])

  const selectedPropertyRoute = resolvePortalPropertyRoute(pathname)
  const selectedProperty = selectPortalProperty(properties, selectedPropertyRoute)
  const propertyDetail = selectedProperty
    ? await readPortalPropertyDetail(client, access.clientContextId, selectedProperty)
    : null
  const propertyRequests = selectedProperty
    ? await readPortalPropertyRequests(client, access.clientContextId, selectedProperty.id)
    : []

  return {
    account: buildAccountContext(access.clientContextId, access.role),
    dashboard: buildDashboardSnapshot(services, serviceRequests, invoices),
    profile,
    propertyDetail,
    properties,
    services,
    requests: serviceRequests,
    invoices,
    profileRequests,
    propertyRequests,
  }
}

export async function submitProfileChangeRequest(input: {
  clientId: string
  changes: JsonRecord
  idempotencyKey: string
}): Promise<PortalReviewedChangeReceipt> {
  const client = getPortalRpcClient()
  return readReviewedChangeReceipt(
    await rpcJson<unknown>(client, 'portal_submit_profile_change_request_v2', {
      p_client_id: input.clientId,
      p_proposed_changes: input.changes,
      p_idempotency_key: input.idempotencyKey,
    }),
    'profile',
  )
}

export async function submitPropertyChangeRequest(input: {
  clientId: string
  propertyId: string
  changes: JsonRecord
  idempotencyKey: string
}): Promise<PortalReviewedChangeReceipt> {
  const client = getPortalRpcClient()
  return readReviewedChangeReceipt(
    await rpcJson<unknown>(client, 'portal_submit_property_change_request_v2', {
      p_client_id: input.clientId,
      p_property_id: input.propertyId,
      p_proposed_changes: input.changes,
      p_idempotency_key: input.idempotencyKey,
    }),
    'property',
  )
}

function getPortalRpcClient(): PortalRpcClientLike {
  const { client, error } = getPortalSupabaseClient()
  if (!client || error) {
    throw new Error(error ?? 'portal_auth_configuration_unavailable')
  }
  return client as unknown as PortalRpcClientLike
}

async function rpcJson<T>(
  client: PortalRpcClientLike,
  functionName: string,
  params: JsonRecord,
): Promise<T> {
  const { data, error } = await client.rpc<T>(functionName, params)
  if (error) throw new Error(error.message ?? 'rpc_denied')
  if (data === null || data === undefined) throw new Error('rpc_empty_response')
  return data
}

function readReviewedChangeReceipt(
  raw: unknown,
  requestType: 'profile' | 'property',
): PortalReviewedChangeReceipt {
  const record = objectValue(raw)
  const reference = stringValue(record.reference)
  const status = stringValue(record.status)
  const requestedAt = stringValue(record.requestedAt)
  const changedFields = arrayValue(record.changedFields)
    .map((field) => stringValue(field))
    .filter(Boolean)

  if (!reference || !requestedAt) {
    throw new Error('reviewed_change_receipt_invalid')
  }

  return {
    reference,
    status: reviewedChangeStatusLabel(status),
    requestedAt,
    changedFields,
    requestType,
  }
}

async function readPortalProfile(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalProfileSnapshot> {
  const raw = await rpcJson<JsonRecord>(client, 'portal_get_client_profile', {
    p_client_id: clientId,
  })

  return buildProfileSnapshot(raw)
}

async function readPortalProperties(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalPropertySummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_properties', {
    p_client_id: clientId,
    p_limit: 50,
  })

  return buildPropertySummaries(raw)
}

async function readPortalPropertyDetail(
  client: PortalRpcClientLike,
  clientId: string,
  property: PortalPropertySummary,
): Promise<PortalPropertyDetail | null> {
  const raw = await rpcJson<unknown>(client, 'portal_get_property', {
    p_client_id: clientId,
    p_property_id: property.id,
  })
  return buildPropertyDetail(raw, property)
}

async function readPortalServices(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalServiceSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_services', {
    p_client_id: clientId,
    p_limit: 25,
  })
  return buildServiceSummaries(raw)
}

async function readPortalServiceRequests(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalServiceRequestSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_service_requests', {
    p_client_id: clientId,
    p_limit: 25,
  })
  return buildServiceRequestSummaries(raw)
}

async function readPortalInvoices(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalInvoiceSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_invoices', {
    p_client_id: clientId,
    p_limit: 25,
  })
  return buildInvoiceSummaries(raw)
}

async function readPortalProfileRequests(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalReviewedChangeRequestSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_own_profile_change_requests_v2', {
    p_client_id: clientId,
    p_limit: 50,
  })
  return buildReviewedChangeSummaries(raw, 'profile')
}

async function readPortalPropertyRequests(
  client: PortalRpcClientLike,
  clientId: string,
  propertyId: string,
): Promise<PortalReviewedChangeRequestSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_own_property_change_requests_v2', {
    p_client_id: clientId,
    p_property_id: propertyId,
    p_limit: 50,
  })
  return buildReviewedChangeSummaries(raw, 'property')
}

function buildAccountContext(clientContextId: string, role: PortalMembershipRole): PortalAccountContext {
  return {
    clientContextId,
    clientDisplayName: 'Área de clientes Costa Clean',
    accountLabel: 'Acceso seguro',
    role,
    isSynthetic: false,
  }
}

function buildDashboardSnapshot(
  services: PortalServiceSummary[],
  requests: PortalServiceRequestSummary[],
  invoices: PortalInvoiceSummary[],
): PortalDashboardSnapshot {
  const nextService = services[0] ?? null
  return {
    nextServiceLabel: nextService
      ? `${nextService.serviceLabel} · ${nextService.scheduleLabel}`
      : 'Sin próximo servicio confirmado',
    openRequestCount: requests.filter((request) => request.statusLabel !== 'Completada').length,
    availableDocumentCount: invoices.length,
    isSynthetic: false,
  }
}

function buildProfileSnapshot(raw: JsonRecord): PortalProfileSnapshot {
  return {
    fullName: stringValue(raw.fullName),
    phone: stringValue(raw.phone),
    email: stringValue(raw.email),
    taxId: stringValue(raw.taxId),
    billingAddress: stringValue(raw.billingAddress),
    fullNameLabel: stringValue(raw.fullName),
    phoneLabel: stringValue(raw.phone),
    emailLabel: stringValue(raw.email),
    taxIdLabel: stringValue(raw.taxId),
    billingAddressLabel: stringValue(raw.billingAddress),
    reviewStateLabel: profileStatusLabel(stringValue(raw.status)),
    isSynthetic: false,
  }
}

function buildPropertySummaries(raw: unknown): PortalPropertySummary[] {
  const rows = arrayValue(raw)
  return rows
    .map((row, index) => {
      const record = objectValue(row)
      const name = stringValue(record.name)
      const propertyType = stringValue(record.propertyType)
      const address = stringValue(record.address)
      const city = stringValue(record.city)
      const postalCode = stringValue(record.postalCode)
      const status = stringValue(record.status)
      return {
        id: stringValue(record.id) || `property-${index + 1}`,
        publicRef: createPublicPropertyReference(name, index),
        displayName: name,
        name,
        propertyType,
        propertyTypeLabel: propertyTypeLabel(propertyType),
        address,
        city,
        postalCode,
        status,
        addressLabel: [address, city].filter(Boolean).join(' · ') || 'Dirección no disponible',
        statusLabel: propertyStatusLabel(status),
        isSynthetic: false,
      }
    })
    .filter((property) => property.displayName.length > 0)
}

function buildPropertyDetail(
  raw: unknown,
  property: PortalPropertySummary,
): PortalPropertyDetail {
  const record = objectValue(raw)
  const name = stringValue(record.name) || property.name
  const propertyType = stringValue(record.propertyType) || property.propertyType
  const address = stringValue(record.address) || property.address
  const city = stringValue(record.city) || property.city
  const postalCode = stringValue(record.postalCode) || property.postalCode
  const status = stringValue(record.status) || property.status

  return {
    id: property.id,
    publicRef: property.publicRef,
    name,
    propertyType,
    address,
    city,
    postalCode,
    status,
    publicRefLabel: property.publicRef.toUpperCase(),
    nameLabel: name,
    propertyTypeLabel: propertyTypeLabel(propertyType),
    addressLabel: [address, city].filter(Boolean).join(' · ') || 'Dirección no disponible',
    cityLabel: city || 'Ciudad no disponible',
    postalCodeLabel: postalCode || 'Código postal no disponible',
    reviewStateLabel: propertyStatusLabel(status),
    isSynthetic: false,
  }
}

function buildServiceSummaries(raw: unknown): PortalServiceSummary[] {
  const rows = arrayValue(raw)
  return rows.map((row, index) => {
    const record = objectValue(row)
    const scheduleLabel = dateTimeLabel(stringValue(record.scheduledDate))
    return {
      id: stringValue(record.id) || `service-${index + 1}`,
      serviceLabel: serviceTypeLabel(stringValue(record.serviceType)),
      propertyLabel: `Propiedad ${index + 1}`,
      scheduleLabel,
      statusLabel: serviceStatusLabel(stringValue(record.status)),
      isSynthetic: false,
    }
  })
}

function buildServiceRequestSummaries(raw: unknown): PortalServiceRequestSummary[] {
  const rows = arrayValue(raw)
  return rows.map((row, index) => {
    const record = objectValue(row)
    const serviceType = stringValue(record.serviceType)
    const preferredDate = stringValue(record.preferredDate)
    const status = stringValue(record.status)
    return {
      id: stringValue(record.id) || `service-request-${index + 1}`,
      requestLabel: serviceTypeLabel(serviceType),
      submittedLabel: dateTimeLabel(stringValue(record.createdAt) || preferredDate),
      statusLabel: serviceRequestStatusLabel(status),
      isSynthetic: false,
    }
  })
}

function buildInvoiceSummaries(raw: unknown): PortalInvoiceSummary[] {
  const rows = arrayValue(raw)
  return rows.map((row, index) => {
    const record = objectValue(row)
    const invoiceNumber = stringValue(record.invoiceNumber)
    const issueDate = stringValue(record.issueDate)
    const status = stringValue(record.status)
    return {
      id: stringValue(record.id) || `invoice-${index + 1}`,
      referenceLabel: invoiceNumber || `Factura ${index + 1}`,
      issuedLabel: dateLabel(issueDate),
      paymentStatusLabel: invoiceStatusLabel(status),
      isSynthetic: false,
    }
  })
}

function buildReviewedChangeSummaries(
  raw: unknown,
  scope: 'profile' | 'property',
): PortalReviewedChangeRequestSummary[] {
  const rows = arrayValue(raw)
  return rows.map((row, index) => {
    const record = objectValue(row)
    const changedFields = arrayValue(record.changedFields).map((field) => stringValue(field)).filter(Boolean)
    const requestedAt = stringValue(record.requestedAt)
    const resolvedAt = record.resolvedAt === null ? null : stringValue(record.resolvedAt)
    const reference = stringValue(record.reference) || `CC-${scope === 'profile' ? 'PR' : 'PT'}-${String(index + 1).padStart(4, '0')}`
    return {
      reference,
      referenceLabel: reference,
      scopeLabel: scope === 'profile' ? 'Perfil' : 'Propiedad',
      fieldSummaryLabel: changedFields.length > 0 ? changedFields.join(' · ') : 'Sin campos visibles',
      submittedLabel: requestedAt ? dateTimeLabel(requestedAt) : 'Fecha no disponible',
      statusLabel: reviewedChangeStatusLabel(stringValue(record.status)),
      requestedAt,
      resolvedAt,
      changedFields,
      requestType: scope,
      isSynthetic: false,
    }
  })
}

function selectPortalProperty(
  properties: PortalPropertySummary[],
  route: PortalPropertyRoute | null,
): PortalPropertySummary | null {
  if (!properties.length) return null
  if (!route) return properties[0]
  return properties.find((property) => property.publicRef === route.publicRef) ?? null
}

function createPublicPropertyReference(name: string, index: number): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  return normalized ? `ref-${normalized}` : `ref-property-${index + 1}`
}

function profileStatusLabel(status: string): string {
  if (status === 'active') return 'Perfil activo'
  if (status === 'pending_review') return 'Perfil pendiente de revisión'
  if (status === 'suspended') return 'Perfil suspendido'
  if (status === 'revoked') return 'Perfil revocado'
  return 'Estado de perfil no disponible'
}

function propertyStatusLabel(status: string): string {
  if (status === 'active') return 'Activo'
  if (status === 'pending_review') return 'Pendiente de revisión'
  if (status === 'archived') return 'Archivada'
  if (status === 'deleted') return 'Eliminada'
  return status ? `Estado ${status}` : 'Estado no disponible'
}

function propertyTypeLabel(value: string): string {
  return value
    ? value
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
    : 'Tipo de propiedad no disponible'
}

function serviceTypeLabel(value: string): string {
  switch (value) {
    case 'regular_cleaning':
      return 'Limpieza regular'
    case 'deep_cleaning':
      return 'Limpieza profunda'
    case 'move_cleaning':
      return 'Limpieza por mudanza'
    case 'commercial_cleaning':
      return 'Limpieza comercial'
    case 'other':
      return 'Servicio solicitado'
    default:
      return 'Servicio no disponible'
  }
}

function serviceStatusLabel(value: string): string {
  if (!value) return 'Estado no disponible'
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function serviceRequestStatusLabel(value: string): string {
  if (!value) return 'Solicitud pendiente'
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function invoiceStatusLabel(value: string): string {
  if (!value) return 'Documento privado'
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function reviewedChangeStatusLabel(value: string): string {
  if (!value) return 'En revisión'
  if (value === 'accepted') return 'Enviado'
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function dateLabel(value: string): string {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}

function dateTimeLabel(value: string): string {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function objectValue(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
