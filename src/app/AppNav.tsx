import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { AppView } from './navigation'
import { getAppViewLabel } from './displayText'
import { getSyncStatusLabel, type SyncStatus } from './syncStatus'
import { AlertsBell } from './AlertsBell'
import { ThemeToggle } from './ThemeToggle'
import type { AppTheme } from './theme'
import type { AutomationAlertItem } from '../features/automation/types'
import type { LogoutOutcome } from '../features/auth/logoutFlow'

interface AppNavProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
  mobileViewport?: boolean
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
  accountLabel: string
  isSigningOut: boolean
  onSignOut: () => Promise<LogoutOutcome>
}

interface NavItemDefinition {
  view: AppView
  shortLabel: string
  icon: () => ReactElement
  section: string
  mobilePriority?: boolean
}

interface NavSection<TItem extends { section: string }> {
  section: string
  items: TItem[]
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

function AlertsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.1c0 .8.2 1.58.58 2.28l1.1 2.03A1.1 1.1 0 0 1 17.2 17H6.8a1.1 1.1 0 0 1-.98-1.59l1.1-2.03c.38-.7.58-1.48.58-2.28V9A4.5 4.5 0 0 1 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2.25 2.25 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 6.75a1.5 1.5 0 1 0 0-.01M12 12a1.5 1.5 0 1 0 0-.01M12 17.25a1.5 1.5 0 1 0 0-.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const navItems: NavItemDefinition[] = [
  { view: 'dashboard', shortLabel: 'Inicio', section: 'General', icon: HomeIcon, mobilePriority: true },
  { view: 'leads', shortLabel: 'Leads', section: 'Comercial', icon: LeadsIcon, mobilePriority: false },
  { view: 'clients', shortLabel: 'Clientes', section: 'Base', icon: ClientsIcon, mobilePriority: true },
  { view: 'properties', shortLabel: 'Inmuebles', section: 'Base', icon: PropertiesIcon, mobilePriority: false },
  { view: 'quotes', shortLabel: 'Presupuestos', section: 'Operaciones', icon: QuotesIcon, mobilePriority: false },
  { view: 'jobs', shortLabel: 'Servicios', section: 'Operaciones', icon: JobsIcon, mobilePriority: true },
  { view: 'invoices', shortLabel: 'Facturas', section: 'Finanzas', icon: InvoicesIcon, mobilePriority: true },
  { view: 'payments', shortLabel: 'Cobros', section: 'Finanzas', icon: PaymentsIcon, mobilePriority: false },
  { view: 'expenses', shortLabel: 'Gastos', section: 'Finanzas', icon: ExpensesIcon, mobilePriority: false },
  { view: 'fiscal_closing', shortLabel: 'Cierre fiscal', section: 'Cierre', icon: QuarterlyClosingIcon, mobilePriority: false },
]

const bottomDockItems = navItems.filter((item) => item.mobilePriority)
const topNavItems = navItems
const mobileSecondaryItems: Array<NavItemDefinition | { view: AppView; shortLabel: string; section: string; icon: () => ReactElement }> = [
  { view: 'alerts', shortLabel: 'Alertas', section: 'Control', icon: AlertsIcon },
  ...navItems.filter((item) => !item.mobilePriority && item.view !== 'dashboard'),
]

function groupNavItems<TItem extends { section: string }>(items: TItem[]): NavSection<TItem>[] {
  const sections = new Map<string, TItem[]>()

  items.forEach((item) => {
    const sectionItems = sections.get(item.section)

    if (sectionItems) {
      sectionItems.push(item)
      return
    }

    sections.set(item.section, [item])
  })

  return Array.from(sections.entries()).map(([section, sectionItems]) => ({
    section,
    items: sectionItems,
  }))
}

function isNavItemActive(itemView: AppView, currentView: AppView) {
  if (itemView === currentView) {
    return true
  }

  return itemView === 'fiscal_closing'
    && (currentView === 'annual_closing' || currentView === 'quarterly_closing')
}

export function AppNav({
  currentView,
  onChangeView,
  mobileViewport = false,
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
  accountLabel,
  isSigningOut,
  onSignOut,
}: AppNavProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const desktopLogoutRef = useRef<HTMLButtonElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileSheetCloseRef = useRef<HTMLButtonElement>(null)
  const currentViewLabel = currentView === 'dashboard' ? 'Inicio' : getAppViewLabel(currentView)
  const currentViewMeta = topNavItems.find((item) => item.view === currentView)
    ?? ((currentView === 'annual_closing' || currentView === 'quarterly_closing')
      ? topNavItems.find((item) => item.view === 'fiscal_closing')
      : undefined)
  const desktopNavSections = groupNavItems(topNavItems)
  const mobileSecondarySections = groupNavItems(mobileSecondaryItems)
  const backLabel = backTargetView ? 'Volver' : 'Inicio'
  const isMoreSectionActive = !bottomDockItems.some((item) => item.view === currentView)
  const mobileHeaderTitle = currentView === 'dashboard' ? 'Hoy' : currentViewLabel
  const shouldShowDesktopCurrent = !mobileViewport && !compactMobile
  const canUsePortal = typeof document !== 'undefined'

  useEffect(() => {
    if (isAccountMenuOpen) {
      desktopLogoutRef.current?.focus()
    }
  }, [isAccountMenuOpen])

  useEffect(() => {
    if (isMoreMenuOpen) {
      mobileSheetCloseRef.current?.focus()
    }
  }, [isMoreMenuOpen])

  useEffect(() => {
    if (!isAccountMenuOpen && !isMoreMenuOpen) {
      return undefined
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      if (isAccountMenuOpen) {
        setIsAccountMenuOpen(false)
        accountTriggerRef.current?.focus()
      }

      if (isMoreMenuOpen) {
        setIsMoreMenuOpen(false)
        moreTriggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isAccountMenuOpen, isMoreMenuOpen])

  async function handleSignOut() {
    const outcome = await onSignOut()

    if (outcome === 'signed-out') {
      setIsAccountMenuOpen(false)
      setIsMoreMenuOpen(false)
    }
  }

  function closeMobileMenu() {
    setIsMoreMenuOpen(false)
    moreTriggerRef.current?.focus()
  }
  const mobileHeader = (
    <header className="cc-mobile-shell-header" aria-label="Cabecera movil">
      <div className="cc-mobile-shell-header__row">
        <div className="cc-mobile-shell-header__leading">
          {currentView !== 'dashboard' ? (
            <button
              type="button"
              className="cc-mobile-shell-header__back"
              onClick={onBack ?? (() => onChangeView('dashboard'))}
              aria-label={backTargetView ? `Volver a ${backTargetView === 'dashboard' ? 'Home' : getAppViewLabel(backTargetView)}` : 'Ir al inicio'}
            >
              {backLabel}
            </button>
          ) : null}

          <div className="cc-mobile-shell-header__brand">
            <img
              src="/branding/Costa_Clean-LOGO.png"
              alt=""
              className="cc-mobile-shell-header__logo"
              aria-hidden="true"
            />

            <div className="cc-mobile-shell-header__copy">
              <span className="cc-mobile-shell-header__title">{mobileHeaderTitle}</span>
              <span className="cc-mobile-shell-header__section">{currentViewMeta?.section ?? 'General'}</span>
            </div>
          </div>
        </div>

        <div className="cc-mobile-shell-header__actions">
          <div
            className={`cc-mobile-shell-header__sync cc-mobile-shell-header__sync--${syncStatus}`}
            aria-live="polite"
            aria-atomic="true"
            title={getSyncStatusLabel(syncStatus)}
          >
            <span className="cc-mobile-shell-header__sync-dot" aria-hidden="true" />
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
        </div>
      </div>
    </header>
  )
  const bottomDock = (
    <>
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
                isNavItemActive(item.view, currentView)
                  ? 'cc-bottom-dock__button is-active'
                  : 'cc-bottom-dock__button'
              }
                onClick={() => onChangeView(item.view)}
                aria-current={isNavItemActive(item.view, currentView) ? 'page' : undefined}
              >
                <span className="cc-bottom-dock__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="cc-bottom-dock__label">{item.shortLabel}</span>
              </button>
            )
          })}

          <button
            ref={moreTriggerRef}
            type="button"
            className={isMoreMenuOpen || isMoreSectionActive ? 'cc-bottom-dock__button is-active' : 'cc-bottom-dock__button'}
            onClick={() => setIsMoreMenuOpen((currentState) => !currentState)}
            aria-expanded={isMoreMenuOpen}
            aria-controls="cc-mobile-nav-more-sheet"
            aria-label="Abrir mas modulos"
          >
            <span className="cc-bottom-dock__icon" aria-hidden="true">
              <MoreIcon />
            </span>
            <span className="cc-bottom-dock__label">Mas</span>
          </button>
        </div>
      </nav>

      {isMoreMenuOpen ? (
        <>
          <button
            type="button"
            className="cc-mobile-nav-sheet__backdrop"
            onClick={closeMobileMenu}
            aria-label="Cerrar menu de modulos"
          />

          <section
            id="cc-mobile-nav-more-sheet"
            className="cc-mobile-nav-sheet"
            aria-label="Mas modulos"
          >
            <div className="cc-mobile-nav-sheet__handle" aria-hidden="true" />

            <div className="cc-mobile-nav-sheet__header">
              <div className="cc-mobile-nav-sheet__copy">
                <span className="cc-mobile-nav-sheet__eyebrow">Navegacion</span>
                <strong className="cc-mobile-nav-sheet__title">Mas modulos</strong>
              </div>

              <button
                ref={mobileSheetCloseRef}
                type="button"
                className="cc-mobile-nav-sheet__close"
                onClick={closeMobileMenu}
                aria-label="Cerrar menu de modulos"
              >
                Cerrar
              </button>
            </div>

            <div className="cc-mobile-nav-sheet__sections">
              {mobileSecondarySections.map((section) => (
                <section key={section.section} className="cc-mobile-nav-sheet__section" aria-label={section.section}>
                  <span className="cc-mobile-nav-sheet__section-label">{section.section}</span>

                  <div className="cc-mobile-nav-sheet__grid">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = isNavItemActive(item.view, currentView)

                      return (
                        <button
                          key={item.view}
                          type="button"
                          className={isActive ? 'cc-mobile-nav-sheet__item is-active' : 'cc-mobile-nav-sheet__item'}
                          onClick={() => {
                            setIsMoreMenuOpen(false)
                            onChangeView(item.view)
                          }}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span className="cc-mobile-nav-sheet__item-icon" aria-hidden="true">
                            <Icon />
                          </span>
                          <span className="cc-mobile-nav-sheet__item-copy">
                            <span className="cc-mobile-nav-sheet__item-title">{item.shortLabel}</span>
                            <span className="cc-mobile-nav-sheet__item-section">{item.section}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}

              <section className="cc-mobile-nav-sheet__section cc-account-section" aria-label="Cuenta">
                <span className="cc-mobile-nav-sheet__section-label">Cuenta</span>
                <div className="cc-account-card">
                  <span className="cc-account-card__identity" title={accountLabel}>{accountLabel}</span>
                  <button
                    type="button"
                    className="cc-account-card__logout"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                  </button>
                </div>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </>
  )

  return (
    <>
      {mobileViewport ? (
        mobileHeader
      ) : (
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

                <div className="cc-account-menu">
                  <button
                    ref={accountTriggerRef}
                    type="button"
                    className="cc-account-menu__trigger"
                    onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
                    aria-expanded={isAccountMenuOpen}
                    aria-controls="cc-desktop-account-menu"
                    aria-label={`Abrir cuenta de ${accountLabel}`}
                  >
                    <span className="cc-account-menu__label">Mi cuenta</span>
                    <span className="cc-account-menu__identity">{accountLabel}</span>
                  </button>

                  {isAccountMenuOpen ? (
                    <div
                      id="cc-desktop-account-menu"
                      className="cc-account-menu__popover"
                      role="menu"
                      aria-label="Cuenta"
                    >
                      <span className="cc-account-menu__popover-identity" title={accountLabel}>
                        {accountLabel}
                      </span>
                      <button
                        ref={desktopLogoutRef}
                        type="button"
                        className="cc-account-menu__logout"
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                      </button>
                    </div>
                  ) : null}
                </div>

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

              {shouldShowDesktopCurrent ? (
                <div className="cc-shell-nav__current" title={currentViewLabel}>
                  <span className="cc-shell-nav__current-label">{currentViewMeta?.section ?? 'Vista'}</span>
                  <strong className="cc-shell-nav__current-value">{currentViewLabel}</strong>
                </div>
              ) : null}
            </div>
          </div>

          <div className="cc-shell-nav__rail" aria-label="Modulos">
            <div className="cc-shell-nav__rail-scroll">
              {desktopNavSections.map((section) => (
                <section key={section.section} className="cc-shell-nav__rail-group" aria-label={section.section}>
                  <span className="cc-shell-nav__rail-group-label">{section.section}</span>

                  <div className="cc-shell-nav__rail-group-items">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = isNavItemActive(item.view, currentView)

                      return (
                        <button
                          key={item.view}
                          type="button"
                          className={isActive ? 'cc-shell-nav__rail-button is-active' : 'cc-shell-nav__rail-button'}
                          onClick={() => onChangeView(item.view)}
                          aria-current={isActive ? 'page' : undefined}
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
                </section>
              ))}
            </div>
          </div>
        </nav>
      )}

      {mobileViewport && canUsePortal ? createPortal(bottomDock, document.body) : bottomDock}
    </>
  )
}
