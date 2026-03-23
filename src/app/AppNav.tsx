import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
}

interface NavItem {
  view: AppView
  shortLabel: string
  icon: string
}

const navItems: NavItem[] = [
  { view: 'dashboard', shortLabel: 'Inicio', icon: '⌂' },
  { view: 'leads', shortLabel: 'Leads', icon: '◎' },
  { view: 'clients', shortLabel: 'Clientes', icon: '◉' },
  { view: 'properties', shortLabel: 'Inmuebles', icon: '▣' },
  { view: 'quotes', shortLabel: 'Presup.', icon: '◌' },
  { view: 'jobs', shortLabel: 'Servicios', icon: '◍' },
  { view: 'invoices', shortLabel: 'Facturas', icon: '◫' },
  { view: 'payments', shortLabel: 'Cobros', icon: '◈' },
]

export function AppNav({ currentView, onChangeView }: AppNavProps) {
  const currentItem =
    navItems.find((item) => item.view === currentView) ?? navItems[0]

  return (
    <>
      <nav className="cc-shell-topbar" aria-label="Cabecera principal">
        <div className="cc-shell-topbar__brand">
          <div className="cc-shell-topbar__brand-mark" aria-hidden="true">
            CC
          </div>

          <div className="cc-shell-topbar__brand-copy">
            <span className="cc-shell-topbar__title">CostaClean CRM</span>
            <span className="cc-shell-topbar__subtitle">
              Native Glass · iPhone · iPad
            </span>
          </div>
        </div>

        <div className="cc-shell-topbar__current">
          <span className="cc-shell-topbar__current-label">Vista actual</span>
          <strong className="cc-shell-topbar__current-value">
            {getAppViewLabel(currentItem.view)}
          </strong>
        </div>
      </nav>

      <nav className="cc-shell-tabs" aria-label="Navegación principal">
        <div className="cc-shell-tabs__scroll">
          {navItems.map((item) => {
            const isActive = currentView === item.view

            return (
              <button
                key={item.view}
                type="button"
                className={
                  isActive
                    ? 'cc-shell-tabs__button is-active'
                    : 'cc-shell-tabs__button'
                }
                onClick={() => onChangeView(item.view)}
                aria-current={isActive ? 'page' : undefined}
                title={getAppViewLabel(item.view)}
              >
                <span className="cc-shell-tabs__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="cc-shell-tabs__label">
                  {getAppViewLabel(item.view)}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <nav className="cc-bottom-dock" aria-label="Navegación inferior">
        <div className="cc-bottom-dock__scroll">
          {navItems.map((item) => {
            const isActive = currentView === item.view

            return (
              <button
                key={item.view}
                type="button"
                className={
                  isActive
                    ? 'cc-bottom-dock__button is-active'
                    : 'cc-bottom-dock__button'
                }
                onClick={() => onChangeView(item.view)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="cc-bottom-dock__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="cc-bottom-dock__label">{item.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}