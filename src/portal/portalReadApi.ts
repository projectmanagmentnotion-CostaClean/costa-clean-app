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
  PortalServiceRequestCancellationInput,
  PortalServiceRequestReceipt,
  PortalServiceRequestSubmissionInput,
  PortalServiceRequestSummary,
  PortalServiceSummary,
} from './contracts'
import type {
  PortalFoundationData,
  PortalProfileSnapshot,
  PortalPropertyDetail,
  PortalReviewedChangeRequestSummary,
  PortalCapabilityStatus,
} from './portalWorkspaceData'
import { createFallbackPortalFoundationData } from './portalWorkspaceData'

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
  const fallback = createFallbackPortalFoundationData(access)
  const [
    profileResult,
    propertiesResult,
    servicesResult,
    serviceRequestsResult,
    invoicesResult,
    profileRequestsResult,
  ] = await Promise.all([
    loadCapability(
      () => readPortalProfile(client, access.clientContextId),
      fallback.profile,
    ),
    loadCapability(
      () => readPortalProperties(client, access.clientContextId),
      fallback.properties,
    ),
    loadCapability(
      () => readPortalServices(client, access.clientContextId),
      fallback.services,
    ),
    loadCapability(
      () => readPortalServiceRequests(client, access.clientContextId),
      fallback.requests,
    ),
    loadCapability(
      () => readPortalInvoices(client, access.clientContextId),
      fallback.invoices,
    ),
    loadCapability(
      () => readPortalProfileRequests(client, access.clientContextId),
      fallback.profileRequests,
    ),
  ])

  const selectedPropertyRoute = resolvePortalPropertyRoute(pathname)
  const selectedProperty = selectPortalProperty(propertiesResult.data, selectedPropertyRoute)
  const propertyDetailResult = selectedProperty
    ? await loadCapability(
      () => readPortalPropertyDetail(client, access.clientContextId, selectedProperty),
      buildPropertyDetailFromSummary(selectedProperty),
    )
    : {
        status: 'UNAVAILABLE' as PortalCapabilityStatus,
        data: null,
        message: 'No hay una propiedad seleccionada.',
      }
  const propertyRequestsResult = selectedProperty
    ? await loadCapability(
      () => readPortalPropertyRequests(client, access.clientContextId, selectedProperty.id),
      fallback.propertyRequests,
    )
    : {
        status: 'UNAVAILABLE' as PortalCapabilityStatus,
        data: fallback.propertyRequests,
        message: 'No hay una propiedad seleccionada.',
      }

  return {
    account: buildAccountContext(access.clientContextId, access.role),
    dashboard: buildDashboardSnapshot(
      servicesResult.data,
      serviceRequestsResult.data,
      invoicesResult.data,
    ),
    capabilities: {
      account: { status: 'REAL' },
      profile: profileResult,
      properties: propertiesResult,
      profileRequests: profileRequestsResult,
      propertyRequests: propertyRequestsResult,
      services: servicesResult,
      serviceRequests: serviceRequestsResult,
      invoices: invoicesResult,
    },
    profile: profileResult.data,
    propertyDetail: propertyDetailResult.data,
    properties: propertiesResult.data,
    services: servicesResult.data,
    requests: serviceRequestsResult.data,
    invoices: invoicesResult.data,
    profileRequests: profileRequestsResult.data,
    propertyRequests: propertyRequestsResult.data,
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
  const raw = await rpcJson<unknown>(client, 'portal_list_services_v2', {
    p_client_id: clientId,
    p_limit: 25,
  })
  return buildServiceSummaries(raw)
}

async function readPortalServiceRequests(
  client: PortalRpcClientLike,
  clientId: string,
): Promise<PortalServiceRequestSummary[]> {
  const raw = await rpcJson<unknown>(client, 'portal_list_own_service_requests_v2', {
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

export async function submitServiceRequest(
  input: PortalServiceRequestSubmissionInput,
): Promise<PortalServiceRequestReceipt> {
  const client = getPortalRpcClient()
  const raw = await rpcJson<unknown>(client, 'portal_submit_service_request_v2', {
    p_client_id: input.clientId,
    p_property_public_ref: input.propertyPublicRef,
    p_service_type: input.serviceType,
    p_preferred_date: input.preferredDate,
    p_preferred_time_window: input.preferredTimeWindow || null,
    p_notes: input.notes,
    p_idempotency_key: input.idempotencyKey,
  })
  return readServiceRequestReceipt(raw)
}

export async function cancelServiceRequest(
  input: PortalServiceRequestCancellationInput,
): Promise<PortalServiceRequestReceipt> {
  const client = getPortalRpcClient()
  const raw = await rpcJson<unknown>(client, 'portal_cancel_own_service_request_v2', {
    p_client_id: input.clientId,
    p_request_reference: input.reference,
    p_expected_version: input.version,
  })
  return readServiceRequestReceipt(raw)
}

interface CapabilityLoadResult<T> {
  status: PortalCapabilityStatus
  data: T
  message?: string
}

async function loadCapability<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<CapabilityLoadResult<T>> {
  try {
    return {
      status: 'REAL',
      data: await loader(),
    }
  } catch (error) {
    const { status, message } = classifyCapabilityError(error)
    return {
      status,
      data: fallback,
      message,
    }
  }
}

function classifyCapabilityError(error: unknown): { status: PortalCapabilityStatus; message: string } {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('rpc_denied') || message.includes('rpc_empty_response')) {
    return { status: 'UNAVAILABLE', message: 'Esta capacidad todavía no está disponible.' }
  }
  if (message.includes('portal_property_reference_')) {
    return { status: 'UNAVAILABLE', message: 'La referencia pública de la propiedad no está disponible.' }
  }
  if (message.includes('portal_service_reference_')) {
    return { status: 'UNAVAILABLE', message: 'La referencia pública del servicio no está disponible.' }
  }
  if (message.includes('portal_service_request_reference_')) {
    return { status: 'UNAVAILABLE', message: 'La referencia pública de la solicitud no está disponible.' }
  }
  if (message.includes('portal_auth_configuration_unavailable') || message.includes('session')) {
    return { status: 'UNAVAILABLE', message: 'La sesión segura no está lista.' }
  }
  return { status: 'ERROR', message: 'No se pudo leer esta capacidad.' }
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
      ? `${nextService.serviceTypeLabel} · ${nextService.scheduleLabel}`
      : 'Sin próximo servicio confirmado',
    openRequestCount: requests.filter((request) => request.status !== 'cancelled' && request.status !== 'rejected').length,
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
  const properties = rows
    .map((row) => {
      const record = objectValue(row)
      const id = stringValue(record.id)
      const publicRef = stringValue(record.publicRef)
      const name = stringValue(record.name)
      if (!id || !publicRef || !name) return null

      const propertyType = stringValue(record.propertyType)
      const address = stringValue(record.address)
      const city = stringValue(record.city)
      const postalCode = stringValue(record.postalCode)
      const status = stringValue(record.status)

      return {
        id,
        publicRef,
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
    .filter((property): property is PortalPropertySummary => property !== null)

  if (rows.length > 0 && properties.length === 0) {
    throw new Error('portal_property_reference_unavailable')
  }

  return properties
}

function buildPropertyDetail(
  raw: unknown,
  property: PortalPropertySummary,
): PortalPropertyDetail {
  const record = objectValue(raw)
  const publicRef = stringValue(record.publicRef)
  if (!publicRef) {
    throw new Error('portal_property_reference_unavailable')
  }
  if (publicRef !== property.publicRef) {
    throw new Error('portal_property_reference_mismatch')
  }
  const name = stringValue(record.name) || property.name
  const propertyType = stringValue(record.propertyType) || property.propertyType
  const address = stringValue(record.address) || property.address
  const city = stringValue(record.city) || property.city
  const postalCode = stringValue(record.postalCode) || property.postalCode
  const status = stringValue(record.status) || property.status

  return {
    id: property.id,
    publicRef,
    name,
    propertyType,
    address,
    city,
    postalCode,
    status,
    publicRefLabel: publicRef.toUpperCase(),
    nameLabel: name,
    propertyTypeLabel: propertyTypeLabel(propertyType),
    addressLabel: [address, city].filter(Boolean).join(' · ') || 'Dirección no disponible',
    cityLabel: city || 'Ciudad no disponible',
    postalCodeLabel: postalCode || 'Código postal no disponible',
    reviewStateLabel: propertyStatusLabel(status),
    isSynthetic: false,
  }
}

function buildPropertyDetailFromSummary(property: PortalPropertySummary): PortalPropertyDetail {
  return {
    id: property.id,
    publicRef: property.publicRef,
    name: property.name,
    propertyType: property.propertyType,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode,
    status: property.status,
    publicRefLabel: property.publicRef.toUpperCase(),
    nameLabel: property.displayName,
    propertyTypeLabel: property.propertyTypeLabel,
    addressLabel: property.addressLabel,
    cityLabel: property.city || 'Ciudad no disponible',
    postalCodeLabel: property.postalCode || 'Código postal no disponible',
    reviewStateLabel: property.statusLabel,
    isSynthetic: false,
  }
}

function buildServiceSummaries(raw: unknown): PortalServiceSummary[] {
  const rows = arrayValue(raw)
  const summaries = rows.map((row) => {
    const record = objectValue(row)
    const reference = stringValue(record.reference)
    const propertyPublicRef = stringValue(record.propertyPublicRef)
    const propertyLabel = stringValue(record.propertyName)
    const propertyAddressLabel = stringValue(record.addressLabel)
    const serviceType = stringValue(record.serviceType)
    const scheduledDate = stringValue(record.scheduledDate)
    const status = stringValue(record.status)

    if (!reference || !propertyPublicRef || !propertyLabel || !serviceType || !scheduledDate || !status) {
      return null
    }

    return {
      reference,
      referenceLabel: reference,
      serviceType,
      serviceTypeLabel: serviceTypeLabel(serviceType),
      propertyPublicRef,
      propertyLabel,
      propertyAddressLabel: propertyAddressLabel || 'Dirección no disponible',
      scheduledDate,
      scheduleLabel: dateLabel(scheduledDate),
      status,
      statusLabel: serviceStatusLabel(status),
      isSynthetic: false,
    }
  }).filter((summary): summary is PortalServiceSummary => summary !== null)

  if (rows.length > 0 && summaries.length === 0) {
    throw new Error('portal_service_reference_unavailable')
  }

  return summaries
}

function buildServiceRequestSummaries(raw: unknown): PortalServiceRequestSummary[] {
  const rows = arrayValue(raw)
  const summaries = rows.map((row) => {
    const record = objectValue(row)
    const reference = stringValue(record.reference)
    const propertyPublicRef = stringValue(record.propertyPublicRef)
    const propertyLabel = stringValue(record.propertyName)
    const propertyAddressLabel = stringValue(record.addressLabel)
    const serviceType = stringValue(record.serviceType)
    const preferredDate = stringValue(record.preferredDate)
    const preferredTimeWindow = stringValue(record.preferredTimeWindow)
    const requestedAt = stringValue(record.requestedAt)
    const resolvedAt = record.resolvedAt === null ? '' : stringValue(record.resolvedAt)
    const notes = stringValue(record.notes)
    const status = stringValue(record.status)
    const version = numberValue(record.version)
    const canCancel = booleanValue(record.canCancel)

    if (!reference || !propertyPublicRef || !propertyLabel || !serviceType || !requestedAt || !status || !Number.isFinite(version)) {
      return null
    }

    return {
      reference,
      referenceLabel: reference,
      propertyPublicRef,
      propertyLabel,
      propertyAddressLabel: propertyAddressLabel || 'Dirección no disponible',
      serviceType,
      serviceTypeLabel: serviceTypeLabel(serviceType),
      preferredDate,
      preferredDateLabel: dateLabel(preferredDate),
      preferredTimeWindow,
      preferredTimeWindowLabel: preferredTimeWindowLabel(preferredTimeWindow),
      requestedAt,
      requestedAtLabel: dateTimeLabel(requestedAt),
      resolvedAt: resolvedAt || null,
      resolvedAtLabel: resolvedAt ? dateTimeLabel(resolvedAt) : null,
      notes,
      notesLabel: notes || 'Sin detalles adicionales',
      status,
      statusLabel: serviceRequestStatusLabel(status),
      canCancel,
      version,
      isSynthetic: false,
    }
  }).filter((summary): summary is PortalServiceRequestSummary => summary !== null)

  if (rows.length > 0 && summaries.length === 0) {
    throw new Error('portal_service_request_reference_unavailable')
  }

  return summaries
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

function readServiceRequestReceipt(raw: unknown): PortalServiceRequestReceipt {
  const record = objectValue(raw)
  const reference = stringValue(record.reference)
  const status = stringValue(record.status)
  const requestedAt = stringValue(record.requestedAt)
  const resolvedAt = record.resolvedAt === null ? null : stringValue(record.resolvedAt)
  const propertyPublicRef = stringValue(record.propertyPublicRef)
  const propertyLabel = stringValue(record.propertyLabel)
  const serviceType = stringValue(record.serviceType)
  const preferredDate = stringValue(record.preferredDate)
  const preferredTimeWindow = stringValue(record.preferredTimeWindow)
  const notes = stringValue(record.notes)
  const version = numberValue(record.version)

  if (!reference || !requestedAt || !propertyPublicRef || !propertyLabel || !serviceType || !preferredDate || !Number.isFinite(version)) {
    throw new Error('service_request_receipt_invalid')
  }

  return {
    reference,
    status: serviceRequestStatusLabel(status),
    requestedAt,
    resolvedAt,
    propertyPublicRef,
    propertyLabel,
    serviceType,
    serviceTypeLabel: serviceTypeLabel(serviceType),
    preferredDate,
    preferredDateLabel: dateLabel(preferredDate),
    preferredTimeWindow,
    preferredTimeWindowLabel: preferredTimeWindowLabel(preferredTimeWindow),
    notes,
    notesLabel: notes || 'Sin detalles adicionales',
    version,
  }
}

function selectPortalProperty(
  properties: PortalPropertySummary[],
  route: PortalPropertyRoute | null,
): PortalPropertySummary | null {
  if (!properties.length) return null
  if (!route) return properties[0]
  return properties.find((property) => property.publicRef === route.publicRef) ?? null
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
      return 'Otro servicio'
    default:
      return 'Servicio no disponible'
  }
}

function serviceStatusLabel(value: string): string {
  switch (value) {
    case 'scheduled':
      return 'Programado'
    case 'in_progress':
      return 'En curso'
    case 'completed':
      return 'Completado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Estado no disponible'
  }
}

function serviceRequestStatusLabel(value: string): string {
  switch (value) {
    case 'pending_review':
      return 'Pendiente de revisión'
    case 'under_review':
      return 'En revisión'
    case 'quoted':
      return 'Propuesta disponible'
    case 'confirmed':
      return 'Servicio programado'
    case 'rejected':
      return 'No aceptada'
    case 'cancelled':
      return 'Cancelada'
    default:
      return 'Solicitud no disponible'
  }
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

function preferredTimeWindowLabel(value: string): string {
  switch (value) {
    case 'morning':
      return 'Mañana'
    case 'afternoon':
      return 'Tarde'
    case 'flexible':
      return 'Flexible'
    default:
      return value ? 'Ventana no disponible' : 'Sin franja preferida'
  }
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

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

function booleanValue(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}
