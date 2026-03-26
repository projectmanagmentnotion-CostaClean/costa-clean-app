import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

const allViews: AppView[] = [
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
    <nav className="cc-shell-nav cc-shell-nav--top-only" aria-label="Navegación principal">
      <div className="cc-shell-nav__topline">
        <div className="cc-shell-nav__brand-copy">
          <span className="cc-shell-nav__title">CostaClean CRM</span>
          <span className="cc-shell-nav__subtitle">Operaciones internas</span>
        </div>

        <div className="cc-shell-nav__actions">
          {currentView !== 'dashboard' ? (
            <button
              type="button"
              className="cc-shell-nav__back"
              onClick={() => onChangeView('dashboard')}
            >
              ← Volver
            </button>
          ) : null}

          <div className="cc-shell-nav__current">
            <span className="cc-shell-nav__current-label">Vista actual</span>
            <strong className="cc-shell-nav__current-value">
              {currentView === 'dashboard' ? 'Home' : getAppViewLabel(currentView)}
            </strong>
          </div>
        </div>
      </div>

      <div className="cc-shell-subnav cc-shell-subnav--top" aria-label="Módulos">
        {allViews.map((view) => (
          <button
            key={view}
            type="button"
            className={
              currentView === view
                ? 'cc-shell-subnav__button is-active'
                : 'cc-shell-subnav__button'
            }
            onClick={() => onChangeView(view)}
          >
            {view === 'dashboard' ? 'Home' : getAppViewLabel(view)}
          </button>
        ))}
      </div>
    </nav>
  )
}