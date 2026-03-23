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
  'payments',
]

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <nav className="cc-shell-nav">
      <div className="cc-shell-nav__brand">
        <span className="cc-shell-nav__title">CostaClean CRM</span>
        <span className="cc-shell-nav__subtitle">iPhone · iPad · Glass UI</span>
      </div>

      <div className="cc-shell-nav__tabs">
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
