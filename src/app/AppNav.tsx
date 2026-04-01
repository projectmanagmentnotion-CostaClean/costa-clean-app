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

const viewShortLabel: Record<AppView, string> = {
  dashboard: 'Home',
  leads: 'Leads',
  clients: 'Clientes',
  properties: 'Propiedades',
  quotes: 'Presupuestos',
  jobs: 'Servicios',
  invoices: 'Facturas',
  expenses: 'Gastos',
  payments: 'Cobros',
}

const viewGlyph: Record<AppView, string> = {
  dashboard: '◉',
  leads: '◌',
  clients: '◎',
  properties: '▣',
  quotes: '◈',
  jobs: '✦',
  invoices: '▤',
  expenses: '◍',
  payments: '●',
}

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  return (
    <nav className="cc-shell-nav cc-shell-nav--top-only" aria-label="Navegación principal">
      <div className="cc-shell-nav__topline">
        <div className="cc-shell-nav__brand">
          <div className="cc-shell-nav__brand-mark" aria-hidden="true">
            <img
              src="/branding/Costa_Clean-LOGO.png"
              alt=""
              className="cc-shell-nav__brand-mark-image"
            />
          </div>

          <div className="cc-shell-nav__brand-copy">
            <span className="cc-shell-nav__title">CostaClean CRM</span>
            <span className="cc-shell-nav__subtitle">Control operativo · limpieza premium</span>
          </div>
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
            <span className="cc-shell-subnav__glyph" aria-hidden="true">
              {viewGlyph[view]}
            </span>
            <span className="cc-shell-subnav__text">
              {viewShortLabel[view]}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}

