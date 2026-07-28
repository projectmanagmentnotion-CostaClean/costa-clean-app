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
  return '/portal'
}
