import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

const appViews: AppView[] = [
  'dashboard',
  'leads',
  'clients',
  'properties',
  'quotes',
  'jobs',
  'invoices',
  'expenses',
  'payments',
]

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <nav className="cc-shell-nav">
      <div className="cc-shell-nav__brand">
        <div>
          <span className="cc-shell-nav__title">CostaClean CRM</span>
          <span className="cc-shell-nav__subtitle">Gestión operativa · iPhone · iPad</span>
        </div>

        <div className="cc-shell-nav__current">
          <span className="cc-shell-nav__current-label">Vista actual</span>
          <strong className="cc-shell-nav__current-value">
            {getAppViewLabel(currentView)}
          </strong>
        </div>
      </div>

      <div className="cc-shell-nav__tabs" aria-label="Navegación principal">
        {appViews.map((view) => (
          <button
            key={view}
            type="button"
            className={
              currentView === view
                ? 'cc-shell-nav__button is-active'
                : 'cc-shell-nav__button'
            }
            onClick={() => onChangeView(view)}
          >
            {getAppViewLabel(view)}
          </button>
        ))}
      </div>
    </nav>
  )
}
