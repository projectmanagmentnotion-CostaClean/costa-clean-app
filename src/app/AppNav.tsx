import type { ReactElement } from 'react'
import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
  compactMobile?: boolean
}

const allViews: AppView[] = [
  'dashboard',
  'quarterly_closing',
  'annual_closing',
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
  quarterly_closing: 'Cierre T',
  annual_closing: 'Cierre A',
  leads: 'Leads',
  clients: 'Clientes',
  properties: 'Propiedades',
  quotes: 'Presupuestos',
  jobs: 'Servicios',
  invoices: 'Facturas',
  expenses: 'Gastos',
  payments: 'Cobros',
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M4 5.5h7v5H4zM13 5.5h7v8h-7zM4 12.5h7v6H4zM13 15.5h7v3h-7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
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

const viewIcon: Record<AppView, () => ReactElement> = {
  dashboard: DashboardIcon,
  quarterly_closing: QuarterlyClosingIcon,
  annual_closing: AnnualClosingIcon,
  leads: LeadsIcon,
  clients: ClientsIcon,
  properties: PropertiesIcon,
  quotes: QuotesIcon,
  jobs: JobsIcon,
  invoices: InvoicesIcon,
  expenses: ExpensesIcon,
  payments: PaymentsIcon,
}

export function AppNav({ currentView, onChangeView, compactMobile = false }: AppNavProps) {
  const currentViewLabel = currentView === 'dashboard' ? 'Home' : getAppViewLabel(currentView)

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
            <div className="cc-shell-nav__brand-mark" aria-hidden="true">
              <img
                src="/branding/Costa_Clean-LOGO.png"
                alt=""
                className="cc-shell-nav__brand-mark-image"
              />
            </div>

            <div className="cc-shell-nav__brand-copy">
              <span className="cc-shell-nav__title">CostaClean CRM</span>
              <span className="cc-shell-nav__subtitle">Control operativo | limpieza premium</span>
            </div>
          </div>

          <div className="cc-shell-nav__actions">
            {currentView !== 'dashboard' ? (
              <button
                type="button"
                className="cc-shell-nav__back"
                onClick={() => onChangeView('dashboard')}
              >
                Ir al inicio
              </button>
            ) : null}

            <div className="cc-shell-nav__current">
              <span className="cc-shell-nav__current-label">Modulo activo</span>
              <strong className="cc-shell-nav__current-value">{currentViewLabel}</strong>
            </div>
          </div>
        </div>

        <div className="cc-shell-subnav cc-shell-subnav--top" aria-label="Modulos">
          {allViews.map((view) => {
            const Icon = viewIcon[view]

            return (
              <button
                key={view}
                type="button"
                className={
                  currentView === view
                    ? 'cc-shell-subnav__button is-active'
                    : 'cc-shell-subnav__button'
                }
                onClick={() => onChangeView(view)}
                aria-current={currentView === view ? 'page' : undefined}
              >
                <span className="cc-shell-subnav__glyph" aria-hidden="true">
                  <Icon />
                </span>
                <span className="cc-shell-subnav__text">{viewShortLabel[view]}</span>
              </button>
            )
          })}
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
          {allViews.map((view) => {
            const Icon = viewIcon[view]

            return (
              <button
                key={view}
                type="button"
                className={
                  currentView === view
                    ? 'cc-bottom-dock__button is-active'
                    : 'cc-bottom-dock__button'
                }
                onClick={() => onChangeView(view)}
                aria-current={currentView === view ? 'page' : undefined}
              >
                <span className="cc-bottom-dock__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="cc-bottom-dock__label">{viewShortLabel[view]}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
