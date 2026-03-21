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
    <nav className="app-nav">
      {appViews.map((view) => (
        <button
          key={view}
          className={currentView === view ? 'nav-button active' : 'nav-button'}
          onClick={() => onChangeView(view)}
        >
          {getAppViewLabel(view)}
        </button>
      ))}
    </nav>
  )
}
