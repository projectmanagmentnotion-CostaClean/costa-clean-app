import {
  portalPreviewScenarios,
  type PortalPreviewScenario,
} from './contracts'

const previewScenarioLabels: Record<PortalPreviewScenario, string> = {
  loading: 'Cargando',
  unauthenticated: 'Sin sesión',
  pending_review: 'Pendiente de revisión',
  authenticated: 'Acceso autorizado',
  suspended: 'Cuenta suspendida',
  revoked: 'Acceso revocado',
  forbidden: 'Sin permisos',
  error: 'Error seguro',
}

interface PortalPreviewBarProps {
  scenario: PortalPreviewScenario | null
}

export function PortalPreviewBar({ scenario }: PortalPreviewBarProps) {
  if (!scenario) {
    return null
  }

  function handleScenarioChange(nextScenario: PortalPreviewScenario) {
    const url = new URL(window.location.href)
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
          onChange={(event) => handleScenarioChange(event.target.value as PortalPreviewScenario)}
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
