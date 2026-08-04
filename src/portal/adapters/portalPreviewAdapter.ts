import {
  portalPreviewScenarios,
  type PortalLifecycleResolution,
  type PortalMembershipContext,
  type PortalPreviewScenario,
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

export function readPortalPreviewScenario(
  search: string,
): PortalPreviewScenario | null {
  const requestedScenario = new URLSearchParams(search).get('portalPreview')
  if (requestedScenario === null) return null
  return previewScenarioSet.has(requestedScenario as PortalPreviewScenario)
    ? requestedScenario as PortalPreviewScenario
    : 'offline'
}

export function createPortalPreviewAdapter(
  scenario: PortalPreviewScenario,
): PortalRuntimeAdapter {
  let notify: ((resolution: PortalLifecycleResolution) => void) | null = null
  let signedInMembership =
    scenario === 'active_member' ? memberMembership : adminMembership
  const isEmptyLikeScenario =
    scenario === 'empty' || scenario === 'property_unavailable'

  function emit(resolution: PortalLifecycleResolution) {
    globalThis.queueMicrotask(() => notify?.(resolution))
  }

  return {
    decoratePath(pathname) {
      const url = new URL(pathname, window.location.origin)
      url.searchParams.set('portalPreview', scenario)
      if (
        new URLSearchParams(window.location.search).get('portalReducedMotion')
        === '1'
      ) {
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
          message:
            'Si existe una cuenta válida, recibirás las instrucciones de recuperación.',
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
    reads: {
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
          : 'Mañana · 10:00 · Servicio de vista previa',
        openRequestCount: isEmptyLikeScenario ? 0 : 1,
        availableDocumentCount: isEmptyLikeScenario ? 0 : 1,
        isSynthetic: true,
      }),
      listProperties: async () => [
        ...(isEmptyLikeScenario
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
            ]),
      ],
      listServices: async () => [
        ...(isEmptyLikeScenario
          ? []
          : [
              {
                id: 'service-preview-1',
                serviceLabel: 'Limpieza de mantenimiento',
                propertyLabel: 'Espacio Norte',
                scheduleLabel: 'Mañana · 10:00',
                statusLabel: 'Planificado · vista previa',
                isSynthetic: true,
              },
            ]),
      ],
      listServiceRequests: async () => [
        ...(isEmptyLikeScenario
          ? []
          : [
              {
                id: 'request-preview-1',
                requestLabel: 'Solicitud de cambio de horario',
                submittedLabel: 'Enviada en la vista previa local',
                statusLabel: 'Pendiente de revisión · vista previa',
                isSynthetic: true,
              },
            ]),
      ],
      listInvoices: async () => [
        ...(isEmptyLikeScenario
          ? []
          : [
              {
                id: 'invoice-preview-1',
                referenceLabel: 'FACTURA-VISTA-PREVIA-001',
                issuedLabel: 'Documento de vista previa · sin validez fiscal',
                paymentStatusLabel: 'Estado de demostración',
                isSynthetic: true,
              },
            ]),
      ],
    },
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
      return {
        status: 'active_member',
        selectedClientId: adminMembership.clientId,
        membership: adminMembership,
      }
    case 'profile_request_success':
    case 'profile_retry':
    case 'profile_conflict':
    case 'property_unavailable':
    case 'property_request_success':
      return {
        status: 'active_member',
        selectedClientId: adminMembership.clientId,
        membership: adminMembership,
      }
  }
}
