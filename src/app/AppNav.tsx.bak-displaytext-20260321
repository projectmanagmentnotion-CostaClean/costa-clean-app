import type { AppView } from './navigation'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <nav className="app-nav">
      <button className={currentView === 'dashboard' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('dashboard')}>Dashboard</button>
      <button className={currentView === 'leads' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('leads')}>Leads</button>
      <button className={currentView === 'clients' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('clients')}>Clients</button>
      <button className={currentView === 'properties' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('properties')}>Properties</button>
      <button className={currentView === 'quotes' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('quotes')}>Quotes</button>
      <button className={currentView === 'jobs' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('jobs')}>Jobs</button>
      <button className={currentView === 'invoices' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('invoices')}>Invoices</button>
      <button className={currentView === 'payments' ? 'nav-button active' : 'nav-button'} onClick={() => onChangeView('payments')}>Payments</button>
    </nav>
  )
}
