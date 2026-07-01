import { BUILD_INFO } from './buildInfo'

export function BuildInfoBadge() {
  return (
    <aside className="cc-build-badge" aria-label="Informacion de build">
      <strong>build {BUILD_INFO.commit}</strong>
      <span>{BUILD_INFO.version}</span>
    </aside>
  )
}
