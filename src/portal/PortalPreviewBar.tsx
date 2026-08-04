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
  if (scenario === 'property_request_success') return '/portal/properties/espacio-demo/correction/success'
  return '/portal'
}
