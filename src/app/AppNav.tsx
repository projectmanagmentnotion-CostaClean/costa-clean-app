import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

const primaryViews: AppView[] = [
  'dashboard',
  'leads',
  'jobs',
  'expenses',
]

const secondaryViews: AppView[] = [
  'clients',
  'properties',
  'quotes',
  'invoices',
  'payments',
]

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <>
      <nav className="cc-shell-nav" aria-label="Contexto de la aplicación">
        <div className="cc-shell-nav__brand">
          <div className="cc-shell-nav__brand-copy">
            <span className="cc-shell-nav__title">CostaClean CRM</span>
            <span className="cc-shell-nav__subtitle">Operaciones internas</span>
          </div>

          <div className="cc-shell-nav__current">
            <span className="cc-shell-nav__current-label">Vista actual</span>
            <strong className="cc-shell-nav__current-value">
              {getAppViewLabel(currentView)}
            </strong>
          </div>
        </div>

        <div className="cc-shell-subnav" aria-label="Módulos secundarios">
          {secondaryViews.map((view) => (
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
              {getAppViewLabel(view)}
            </button>
          ))}
        </div>
      </nav>

      <nav className="cc-bottom-dock" aria-label="Navegación principal">
        <div className="cc-bottom-dock__scroll">
          {primaryViews.map((view) => (
            <button
              key={view}
              type="button"
              className={
                currentView === view
                  ? 'cc-bottom-dock__button is-active'
                  : 'cc-bottom-dock__button'
              }
              onClick={() => onChangeView(view)}
            >
              <span className="cc-bottom-dock__label">
                {getAppViewLabel(view)}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
