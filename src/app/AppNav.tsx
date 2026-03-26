import type { ReactNode } from 'react'
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

function renderIcon(view: AppView): ReactNode {
  switch (view) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3.5 10.5 12 4l8.5 6.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 21v-5.5A1.5 1.5 0 0 1 10.5 14h3a1.5 1.5 0 0 1 1.5 1.5V21"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'leads':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M16.5 20a4.5 4.5 0 0 0-9 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle
            cx="12"
            cy="8"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      )
    case 'jobs':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect
            x="4"
            y="7"
            width="16"
            height="13"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      )
    case 'expenses':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 4.5h10a2 2 0 0 1 2 2v11A2.5 2.5 0 0 1 16.5 20H7a2 2 0 0 1-2-2v-11a2.5 2.5 0 0 1 2-2.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 9h7M8.5 12h7M8.5 15h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    default:
      return null
  }
}

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
              <span className="cc-bottom-dock__icon">
                {renderIcon(view)}
              </span>
              <span className="cc-bottom-dock__label">
                {view === 'dashboard' ? 'Home' : getAppViewLabel(view)}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}