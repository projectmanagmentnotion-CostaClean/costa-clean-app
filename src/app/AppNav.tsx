import type { ReactElement } from 'react'
import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'
import { getSyncStatusLabel, type SyncStatus } from './syncStatus'
import { AlertsBell } from './AlertsBell'
import { ThemeToggle } from './ThemeToggle'
import type { AppTheme } from './theme'
import type { AutomationAlertItem } from '../features/automation/types'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
  compactMobile?: boolean
  syncStatus?: SyncStatus
  alerts?: AutomationAlertItem[]
  reviewedAlertIds?: string[]
  onOpenAlert?: (alert: AutomationAlertItem) => void
  onOpenAlertsCenter?: () => void
  theme?: AppTheme
  onToggleTheme?: () => void
  backTargetView?: AppView | null
  onBack?: () => void
}

interface NavItemDefinition {
  view: AppView
  shortLabel: string
  icon: () => ReactElement
  section: string
  mobilePriority?: boolean
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M4.5 10.5 12 4l7.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-5v5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LeadsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4.5 18a4.5 4.5 0 0 1 9 0M16.5 8.5h4M18.5 6.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function QuarterlyClosingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M6 5.5h12A1.5 1.5 0 0 1 19.5 7v10A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V7A1.5 1.5 0 0 1 6 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8 10.5h8M8 14h5M8 5.5v-2M16 5.5v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AnnualClosingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M6 4.5h12A1.5 1.5 0 0 1 19.5 6v12A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8 9h8M8 13h8M8 17h5M8 4.5v-2M16 4.5v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17" cy="9.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4.5 18a4.5 4.5 0 0 1 9 0M13.5 18a3.7 3.7 0 0 1 6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PropertiesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M5 10.5 12 5l7 5.5V19H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10 19v-4h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function QuotesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5v4h4M9 12h6M9 15.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function JobsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <rect x="4" y="7" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function InvoicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5v4h4M9 12h6M9 15.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ExpensesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 5.5h10M8 4h8v3H8zM6.5 8.5h11A1.5 1.5 0 0 1 19 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.5h6M9 16h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PaymentsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <rect x="4" y="6" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4 10h16M8 14.5h3.5M15.5 14.5h.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

const navItems: NavItemDefinition[] = [
  { view: 'dashboard', shortLabel: 'Home', section: 'General', icon: HomeIcon, mobilePriority: true },
  { view: 'leads', shortLabel: 'Leads', section: 'Comercial', icon: LeadsIcon, mobilePriority: true },
  { view: 'clients', shortLabel: 'Clientes', section: 'Base', icon: ClientsIcon, mobilePriority: true },
  { view: 'properties', shortLabel: 'Inmuebles', section: 'Base', icon: PropertiesIcon, mobilePriority: true },
  { view: 'quotes', shortLabel: 'Presupuestos', section: 'Operaciones', icon: QuotesIcon, mobilePriority: true },
  { view: 'jobs', shortLabel: 'Servicios', section: 'Operaciones', icon: JobsIcon, mobilePriority: true },
  { view: 'invoices', shortLabel: 'Facturas', section: 'Finanzas', icon: InvoicesIcon, mobilePriority: true },
  { view: 'payments', shortLabel: 'Cobros', section: 'Finanzas', icon: PaymentsIcon, mobilePriority: true },
  { view: 'expenses', shortLabel: 'Gastos', section: 'Finanzas', icon: ExpensesIcon, mobilePriority: false },
  { view: 'quarterly_closing', shortLabel: 'Cierre trimestral', section: 'Cierre', icon: QuarterlyClosingIcon, mobilePriority: false },
  { view: 'annual_closing', shortLabel: 'Cierre anual', section: 'Cierre', icon: AnnualClosingIcon, mobilePriority: false },
]

const bottomDockItems = navItems.filter((item) => item.mobilePriority)
const topNavItems = navItems

export function AppNav({
  currentView,
  onChangeView,
  compactMobile = false,
  syncStatus = 'fresh',
  alerts = [],
  reviewedAlertIds = [],
  onOpenAlert,
  onOpenAlertsCenter,
  theme = 'dark',
  onToggleTheme,
  backTargetView = null,
  onBack,
}: AppNavProps) {
  const currentViewLabel = currentView === 'dashboard' ? 'Home' : getAppViewLabel(currentView)
  const currentViewMeta = topNavItems.find((item) => item.view === currentView)
  const backLabel = backTargetView ? 'Volver' : 'Inicio'

  return (
    <>
      <nav
        className={
          compactMobile
            ? 'cc-shell-nav cc-shell-nav--top-only cc-shell-nav--mobile-compact'
            : 'cc-shell-nav cc-shell-nav--top-only'
        }
        aria-label="Navegacion principal"
      >
        <div className="cc-shell-nav__topline">
          <div className="cc-shell-nav__brand">
            <img
              src="/branding/Costa_Clean-LOGO.png"
              alt=""
              className="cc-shell-nav__logo"
              aria-hidden="true"
            />

            <div className="cc-shell-nav__brand-copy">
              <span className="cc-shell-nav__title">{compactMobile ? 'CostaClean' : 'CostaClean CRM'}</span>
            </div>
          </div>

          <div className="cc-shell-nav__actions">
            <div className="cc-shell-nav__utilities">
              <div
                className={`cc-shell-nav__sync cc-shell-nav__sync--${syncStatus}`}
                aria-live="polite"
                aria-atomic="true"
                title={getSyncStatusLabel(syncStatus)}
              >
                <span className="cc-shell-nav__sync-dot" aria-hidden="true" />
                <span>Sync</span>
              </div>

              {onToggleTheme ? <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} /> : null}

              {onOpenAlert && onOpenAlertsCenter ? (
                <AlertsBell
                  alerts={alerts}
                  reviewedAlertIds={reviewedAlertIds}
                  onOpenAlert={onOpenAlert}
                  onOpenAlertsCenter={onOpenAlertsCenter}
                />
              ) : null}

              {currentView !== 'dashboard' ? (
                <button
                  type="button"
                  className="cc-shell-nav__back"
                  onClick={onBack ?? (() => onChangeView('dashboard'))}
                  aria-label={backTargetView ? `Volver a ${backTargetView === 'dashboard' ? 'Home' : getAppViewLabel(backTargetView)}` : 'Ir al inicio'}
                >
                  {backLabel}
                </button>
              ) : null}
            </div>

            {!compactMobile ? (
              <div className="cc-shell-nav__current" title={currentViewLabel}>
                <span className="cc-shell-nav__current-label">{currentViewMeta?.section ?? 'Vista'}</span>
                <strong className="cc-shell-nav__current-value">{currentViewLabel}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="cc-shell-nav__rail" aria-label="Modulos">
          <div className="cc-shell-nav__rail-scroll">
            {topNavItems.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.view}
                  type="button"
                  className={
                    currentView === item.view
                      ? 'cc-shell-nav__rail-button is-active'
                      : 'cc-shell-nav__rail-button'
                  }
                  onClick={() => onChangeView(item.view)}
                  aria-current={currentView === item.view ? 'page' : undefined}
                  title={`${item.shortLabel} - ${item.section}`}
                  aria-label={`${item.shortLabel}, ${item.section}`}
                >
                  <span className="cc-shell-nav__rail-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="cc-shell-nav__rail-copy">
                    <span className="cc-shell-nav__rail-title">{item.shortLabel}</span>
                    <span className="cc-shell-nav__rail-section">{item.section}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <nav
        className={
          compactMobile
            ? 'cc-bottom-dock cc-bottom-dock--mobile cc-bottom-dock--compact'
            : 'cc-bottom-dock cc-bottom-dock--mobile'
        }
        aria-label="Navegacion rapida"
      >
        <div className="cc-bottom-dock__scroll">
          {bottomDockItems.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.view}
                type="button"
                className={
                  currentView === item.view
                    ? 'cc-bottom-dock__button is-active'
                    : 'cc-bottom-dock__button'
                }
                onClick={() => onChangeView(item.view)}
                aria-current={currentView === item.view ? 'page' : undefined}
              >
                <span className="cc-bottom-dock__icon" aria-hidden="true">
                  <Icon />
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
