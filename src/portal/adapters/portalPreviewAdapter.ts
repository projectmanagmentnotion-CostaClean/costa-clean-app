import {
  portalPreviewScenarios,
  type PortalLifecycleResolution,
  type PortalMembershipContext,
  type PortalPreviewScenario,
  type PortalReadAdapter,
  type PortalServiceRequestCancellationInput,
  type PortalServiceRequestReceipt,
  type PortalServiceRequestSubmissionInput,
  type PortalServiceRequestSummary,
  type PortalServiceSummary,
  type PortalRuntimeAdapter,
} from '../contracts'

const previewScenarioSet = new Set<PortalPreviewScenario>(portalPreviewScenarios)
const previewClientId = 'client-preview-main'
const adminMembership: PortalMembershipContext = {
  clientId: previewClientId,
  membershipId: '11111111-1111-4111-8111-111111111111',
  role: 'client_admin',
  status: 'active',
}
const memberMembership: PortalMembershipContext = {
  clientId: previewClientId,
  membershipId: '22222222-2222-4222-8222-222222222222',
  role: 'client_member',
  status: 'active',
}

export function readPortalPreviewScenario(search: string): PortalPreviewScenario | null {
  const requestedScenario = new URLSearchParams(search).get('portalPreview')
  if (requestedScenario === null) return null
  return previewScenarioSet.has(requestedScenario as PortalPreviewScenario)
    ? (requestedScenario as PortalPreviewScenario)
    : 'offline'
}

export function createPortalPreviewAdapter(
  scenario: PortalPreviewScenario,
): PortalRuntimeAdapter {
  let notify: ((resolution: PortalLifecycleResolution) => void) | null = null
  let signedInMembership = scenario === 'active_member' ? memberMembership : adminMembership
  const isEmptyLikeScenario = scenario === 'empty'
    || scenario === 'property_unavailable'
    || scenario === 'services_empty'

  function emit(resolution: PortalLifecycleResolution) {
    globalThis.queueMicrotask(() => notify?.(resolution))
  }

  const reads: PortalReadAdapter = {
    getAccountContext: async () => ({
      clientContextId: signedInMembership.clientId,
      clientDisplayName: 'Cliente de vista previa',
      accountLabel: 'Cuenta de vista previa',
      role: signedInMembership.role,
      isSynthetic: true,
    }),
    getDashboard: async () => ({
      nextServiceLabel: isEmptyLikeScenario
        ? 'Sin próximo servicio confirmado'
        : 'Mañana · 10:00 · Limpieza regular',
      openRequestCount: isEmptyLikeScenario ? 0 : 1,
      availableDocumentCount: isEmptyLikeScenario ? 0 : 1,
      isSynthetic: true,
    }),
    listProperties: async () => (
      isEmptyLikeScenario
        ? []
        : [
            {
              id: 'property-preview-north',
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
            {
              id: 'property-preview-center',
              publicRef: 'ref-espacio-centro',
              displayName: 'Espacio Centro',
              name: 'Espacio Centro',
              propertyType: 'oficina',
              propertyTypeLabel: 'Oficina',
              address: 'Avenida Diagonal 88',
              city: 'Barcelona',
              postalCode: '08018',
              status: 'active',
              addressLabel: 'Avenida Diagonal 88 · Barcelona',
              statusLabel: 'Activo · vista previa',
              isSynthetic: true,
            },
          ]
    ),
    listServices: async () => (
      isEmptyLikeScenario
        ? []
        : [
            buildPreviewService({
              reference: 'JOB-PREV-001',
              serviceType: 'regular_cleaning',
              propertyPublicRef: 'ref-espacio-norte',
              propertyLabel: 'Espacio Norte',
              propertyAddressLabel: 'Calle Marina 12 · Barcelona',
              scheduledDate: '2026-08-06',
              status: 'scheduled',
            }),
            buildPreviewService({
              reference: 'JOB-PREV-002',
              serviceType: 'deep_cleaning',
              propertyPublicRef: 'ref-espacio-centro',
              propertyLabel: 'Espacio Centro',
              propertyAddressLabel: 'Avenida Diagonal 88 · Barcelona',
              scheduledDate: '2026-07-28',
              status: 'completed',
            }),
          ]
    ),
    listServiceRequests: async () => (
      isEmptyLikeScenario
        ? []
        : [
            buildPreviewRequest({
              reference: 'CC-SR-PREV-001',
              propertyPublicRef: 'ref-espacio-norte',
              propertyLabel: 'Espacio Norte',
              propertyAddressLabel: 'Calle Marina 12 · Barcelona',
              serviceType: 'regular_cleaning',
              preferredDate: '2026-08-08',
              preferredTimeWindow: 'morning',
              requestedAt: '2026-08-05T08:30:00Z',
              resolvedAt: null,
              notes: 'Vista previa sintética',
              status: scenario === 'request_cancelled' ? 'cancelled' : 'pending_review',
              canCancel: scenario !== 'request_not_cancellable' && scenario !== 'request_cancelled',
              version: 1,
            }),
            buildPreviewRequest({
              reference: 'CC-SR-PREV-002',
              propertyPublicRef: 'ref-espacio-centro',
              propertyLabel: 'Espacio Centro',
              propertyAddressLabel: 'Avenida Diagonal 88 · Barcelona',
              serviceType: 'deep_cleaning',
              preferredDate: '2026-08-02',
              preferredTimeWindow: 'afternoon',
              requestedAt: '2026-07-30T12:15:00Z',
              resolvedAt: '2026-07-30T14:40:00Z',
              notes: 'Seguimiento sintético',
              status: scenario === 'request_retry' ? 'under_review' : 'confirmed',
              canCancel: false,
              version: 2,
            }),
          ]
    ),
    listInvoices: async () => (
      isEmptyLikeScenario
        ? []
        : [
            {
              id: 'invoice-preview-1',
              referenceLabel: 'FACTURA-VISTA-PREVIA-001',
              issuedLabel: 'Documento de vista previa · sin validez fiscal',
              paymentStatusLabel: 'Estado de demostración',
              isSynthetic: true,
            },
          ]
    ),
    submitServiceRequest: async (input: PortalServiceRequestSubmissionInput): Promise<PortalServiceRequestReceipt> => ({
      reference: 'CC-SR-PREV-NEW',
      status: 'Pendiente de revisión',
      requestedAt: new Date().toISOString(),
      resolvedAt: null,
      propertyPublicRef: input.propertyPublicRef,
      propertyLabel: 'Propiedad de vista previa',
      serviceType: input.serviceType,
      serviceTypeLabel: labelServiceType(input.serviceType),
      preferredDate: input.preferredDate,
      preferredDateLabel: input.preferredDate,
      preferredTimeWindow: input.preferredTimeWindow,
      preferredTimeWindowLabel: labelTimeWindow(input.preferredTimeWindow),
      notes: input.notes,
      notesLabel: input.notes || 'Sin detalles adicionales',
      version: 1,
    }),
    cancelServiceRequest: async (input: PortalServiceRequestCancellationInput): Promise<PortalServiceRequestReceipt> => ({
      reference: input.reference,
      status: 'Cancelada',
      requestedAt: '2026-08-05T08:30:00Z',
      resolvedAt: new Date().toISOString(),
      propertyPublicRef: 'ref-espacio-norte',
      propertyLabel: 'Espacio Norte',
      serviceType: 'regular_cleaning',
      serviceTypeLabel: labelServiceType('regular_cleaning'),
      preferredDate: '2026-08-08',
      preferredDateLabel: '2026-08-08',
      preferredTimeWindow: 'morning',
      preferredTimeWindowLabel: 'Mañana',
      notes: 'Vista previa sintética',
      notesLabel: 'Vista previa sintética',
      version: input.version + 1,
    }),
  }

  return {
    decoratePath(pathname) {
      const url = new URL(pathname, window.location.origin)
      url.searchParams.set('portalPreview', scenario)
      if (new URLSearchParams(window.location.search).get('portalReducedMotion') === '1') {
        url.searchParams.set('portalReducedMotion', '1')
      }
      return `${url.pathname}${url.search}`
    },
    lifecycle: {
      start(onResolution) {
        notify = onResolution
        const resolution = getPreviewResolution(scenario)
        if (resolution) emit(resolution)
        return () => {
          notify = null
        }
      },
      retry() {
        emit(getPreviewResolution(scenario) ?? { status: 'booting' })
      },
      async signIn() {
        emit({
          status: 'active_member',
          selectedClientId: signedInMembership.clientId,
          membership: signedInMembership,
        })
        return { ok: true, message: 'Acceso de vista previa confirmado.' }
      },
      async requestPasswordRecovery() {
        return {
          ok: true,
          message: 'Si existe una cuenta válida, recibirás las instrucciones de recuperación.',
        }
      },
      async updatePassword() {
        emit({ status: 'unauthenticated' })
        return {
          ok: true,
          message: 'Contraseña actualizada. Vuelve a iniciar sesión.',
        }
      },
      async signOut() {
        signedInMembership = adminMembership
        emit({ status: 'unauthenticated' })
        return { ok: true, message: 'Sesión cerrada.' }
      },
    },
    reads,
    previewScenario: scenario,
  }
}

function getPreviewResolution(
  scenario: PortalPreviewScenario,
): PortalLifecycleResolution | null {
  switch (scenario) {
    case 'loading':
      return null
    case 'login':
    case 'recovery':
      return { status: 'unauthenticated' }
    case 'reset':
      return { status: 'password_recovery' }
    case 'active_admin':
      return {
        status: 'active_member',
        selectedClientId: adminMembership.clientId,
        membership: adminMembership,
      }
    case 'active_member':
      return {
        status: 'active_member',
        selectedClientId: memberMembership.clientId,
        membership: memberMembership,
      }
    case 'multi_client':
      return {
        status: 'client_selection_required',
        memberships: [
          {
            clientId: 'client-preview-a',
            membershipId: '33333333-3333-4333-8333-333333333333',
            role: 'client_admin',
            status: 'active',
          },
          {
            clientId: 'client-preview-b',
            membershipId: '44444444-4444-4444-8444-444444444444',
            role: 'client_member',
            status: 'active',
          },
        ],
      }
    case 'pending_review':
      return { status: 'pending_review' }
    case 'suspended':
      return { status: 'suspended' }
    case 'revoked':
      return { status: 'revoked' }
    case 'without_access':
      return { status: 'authenticated_without_access' }
    case 'session_expired':
      return { status: 'session_expired' }
    case 'offline':
      return {
        status: 'error',
        message: 'No hemos podido comprobar tu acceso. Revisa la conexión e inténtalo de nuevo.',
      }
    case 'empty':
    case 'property_unavailable':
    case 'profile_request_success':
    case 'profile_retry':
    case 'profile_conflict':
    case 'property_request_success':
    case 'services_loading':
    case 'services_empty':
    case 'services_error':
    case 'next_service':
    case 'service_history':
    case 'service_unavailable':
    case 'request_draft':
    case 'request_review':
    case 'request_success':
    case 'request_retry':
    case 'request_conflict':
    case 'request_cancelled':
    case 'request_not_cancellable':
      return {
        status: 'active_member',
        selectedClientId: adminMembership.clientId,
        membership: adminMembership,
      }
  }
}

function buildPreviewService(input: {
  reference: string
  serviceType: string
  propertyPublicRef: string
  propertyLabel: string
  propertyAddressLabel: string
  scheduledDate: string
  status: string
}): PortalServiceSummary {
  return {
    reference: input.reference,
    referenceLabel: input.reference,
    serviceType: input.serviceType,
    serviceTypeLabel: labelServiceType(input.serviceType),
    propertyPublicRef: input.propertyPublicRef,
    propertyLabel: input.propertyLabel,
    propertyAddressLabel: input.propertyAddressLabel,
    scheduledDate: input.scheduledDate,
    scheduleLabel: input.scheduledDate,
    status: input.status,
    statusLabel: labelServiceStatus(input.status),
    isSynthetic: true,
  }
}

function buildPreviewRequest(input: {
  reference: string
  propertyPublicRef: string
  propertyLabel: string
  propertyAddressLabel: string
  serviceType: string
  preferredDate: string
  preferredTimeWindow: string
  requestedAt: string
  resolvedAt: string | null
  notes: string
  status: string
  canCancel: boolean
  version: number
}): PortalServiceRequestSummary {
  return {
    reference: input.reference,
    referenceLabel: input.reference,
    propertyPublicRef: input.propertyPublicRef,
    propertyLabel: input.propertyLabel,
    propertyAddressLabel: input.propertyAddressLabel,
    serviceType: input.serviceType,
    serviceTypeLabel: labelServiceType(input.serviceType),
    preferredDate: input.preferredDate,
    preferredDateLabel: input.preferredDate,
    preferredTimeWindow: input.preferredTimeWindow,
    preferredTimeWindowLabel: labelTimeWindow(input.preferredTimeWindow),
    requestedAt: input.requestedAt,
    requestedAtLabel: input.requestedAt,
    resolvedAt: input.resolvedAt,
    resolvedAtLabel: input.resolvedAt,
    notes: input.notes,
    notesLabel: input.notes,
    status: input.status,
    statusLabel: labelServiceRequestStatus(input.status),
    canCancel: input.canCancel,
    version: input.version,
    isSynthetic: true,
  }
}

function labelServiceType(value: string): string {
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

function labelServiceStatus(value: string): string {
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

function labelServiceRequestStatus(value: string): string {
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

function labelTimeWindow(value: string): string {
  switch (value) {
    case 'morning':
      return 'Mañana'
    case 'afternoon':
      return 'Tarde'
    case 'flexible':
      return 'Flexible'
    default:
      return 'Sin franja preferida'
  }
}
