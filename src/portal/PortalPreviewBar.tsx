import {
  portalPreviewScenarios,
  type PortalPreviewScenario,
} from './contracts'

const previewScenarioLabels: Record<PortalPreviewScenario, string> = {
  loading: 'Cargando',
  login: 'Inicio de sesión',
  recovery: 'Recuperación',
  reset: 'Nueva contraseña',
  active_admin: 'Cliente administrador',
  active_member: 'Cliente miembro',
  multi_client: 'Selección de cuenta',
  pending_review: 'Pendiente de revisión',
  suspended: 'Cuenta suspendida',
  revoked: 'Acceso revocado',
  without_access: 'Sin acceso asignado',
  session_expired: 'Sesión expirada',
  offline: 'Error de conexión',
  empty: 'Vacío',
  profile_request_success: 'Perfil enviado',
  profile_retry: 'Perfil reintento',
  profile_conflict: 'Perfil conflicto',
  property_unavailable: 'Propiedad no disponible',
  property_request_success: 'Propiedad enviada',
  services_loading: 'Servicios cargando',
  services_empty: 'Servicios vacíos',
  services_error: 'Servicios error',
  next_service: 'Próximo servicio',
  service_history: 'Historial de servicios',
  service_unavailable: 'Servicio no disponible',
  request_draft: 'Solicitud borrador',
  request_review: 'Solicitud revisión',
  request_success: 'Solicitud enviada',
  request_retry: 'Solicitud reintento',
  request_conflict: 'Solicitud conflicto',
  request_cancelled: 'Solicitud cancelada',
  request_not_cancellable: 'Solicitud bloqueada',
}

interface PortalPreviewBarProps {
  scenario: PortalPreviewScenario | null
}

export function PortalPreviewBar({ scenario }: PortalPreviewBarProps) {
  if (!scenario) return null

  function handleScenarioChange(nextScenario: PortalPreviewScenario) {
    const url = new URL(window.location.href)
    url.pathname = getPreviewPath(nextScenario)
    url.searchParams.set('portalPreview', nextScenario)
    window.location.assign(url)
  }

  return (
    <aside className="portal-preview-bar" aria-label="Controles de vista previa local">
      <span className="portal-preview-bar__badge">Preview local · datos sintéticos</span>
      <label className="portal-preview-bar__control">
        <span>Estado de acceso</span>
        <select
          value={scenario}
          onChange={(event) =>
            handleScenarioChange(event.target.value as PortalPreviewScenario)}
        >
          {portalPreviewScenarios.map((previewScenario) => (
            <option key={previewScenario} value={previewScenario}>
              {previewScenarioLabels[previewScenario]}
            </option>
          ))}
        </select>
      </label>
    </aside>
  )
}

function getPreviewPath(scenario: PortalPreviewScenario) {
  if (scenario === 'recovery') return '/portal/recover'
  if (scenario === 'reset') return '/portal/reset-password'
  if (scenario === 'login') return '/portal/login'
  if (scenario === 'profile_request_success') return '/portal/profile/correction/success'
  if (scenario === 'profile_retry') return '/portal/profile/correction/review'
  if (scenario === 'profile_conflict') return '/portal/profile/requests'
  if (scenario === 'property_unavailable') return '/portal/properties'
  if (scenario === 'property_request_success') return '/portal/properties/ref-espacio-norte/correction/success'
  if (scenario === 'services_loading') return '/portal/services'
  if (scenario === 'services_empty') return '/portal/services'
  if (scenario === 'services_error') return '/portal/services'
  if (scenario === 'next_service') return '/portal/services'
  if (scenario === 'service_history') return '/portal/services'
  if (scenario === 'service_unavailable') return '/portal/services'
  if (scenario === 'request_draft') return '/portal/service-requests/new/property'
  if (scenario === 'request_review') return '/portal/service-requests/new/review'
  if (scenario === 'request_success') return '/portal/service-requests/new/success'
  if (scenario === 'request_retry') return '/portal/service-requests'
  if (scenario === 'request_conflict') return '/portal/service-requests'
  if (scenario === 'request_cancelled') return '/portal/service-requests/CC-SR-PREV-001'
  if (scenario === 'request_not_cancellable') return '/portal/service-requests/CC-SR-PREV-002'
  return '/portal'
}
