import type { AppView } from './navigation'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <nav className="app-nav">
      <button
        className={currentView === 'dashboard' ? 'nav-button active' : 'nav-button'}
        onClick={() => onChangeView('dashboard')}
      >
        Dashboard
      </button>

      <button
        className={currentView === 'leads' ? 'nav-button active' : 'nav-button'}
        onClick={() => onChangeView('leads')}
      >
        Leads
      </button>
    </nav>
  )
}
