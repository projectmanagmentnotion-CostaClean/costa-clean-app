import { useEffect, useState } from 'react'
import type { PortalAccessState } from './accessMachine'
import type {
  PortalAccountContext,
  PortalDashboardSnapshot,
  PortalInvoiceSummary,
  PortalPreviewScenario,
  PortalPropertySummary,
  PortalReadAdapter,
  PortalServiceRequestSummary,
  PortalServiceSummary,
} from './contracts'
import {
  getPortalPagePath,
  resolvePortalPage,
  type PortalPage,
} from './portalNavigation'
import { PortalPages } from './PortalPages'
import { PortalShell } from './PortalShell'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalFoundationData {
  account: PortalAccountContext
  dashboard: PortalDashboardSnapshot
  properties: PortalPropertySummary[]
  services: PortalServiceSummary[]
  requests: PortalServiceRequestSummary[]
  invoices: PortalInvoiceSummary[]
}

type PortalDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: PortalFoundationData }
  | { status: 'error' }

export interface PortalPreviewShellProps {
  access: AuthenticatedPortalAccess
  reads: PortalReadAdapter | null
  previewScenario: PortalPreviewScenario | null
  onSignOut: () => void
}

const portalNavigationItems: Array<{
  page: PortalPage
  label: string
  shortLabel: string
  group: 'primary' | 'more'
}> = [
  { page: 'home', label: 'Inicio', shortLabel: 'Inicio', group: 'primary' },
  { page: 'services', label: 'Servicios', shortLabel: 'Servicios', group: 'primary' },
  { page: 'invoices', label: 'Facturas', shortLabel: 'Facturas', group: 'primary' },
  { page: 'profile', label: 'Mi perfil', shortLabel: 'Perfil', group: 'more' },
  { page: 'properties', label: 'Propiedades', shortLabel: 'Propiedades', group: 'more' },
  { page: 'requests', label: 'Solicitudes', shortLabel: 'Solicitudes', group: 'more' },
  { page: 'security', label: 'Seguridad', shortLabel: 'Seguridad', group: 'more' },
]

const portalPageLabels: Record<PortalPage, string> = {
  home: 'Inicio',
  profile: 'Mi perfil',
  properties: 'Propiedades',
  services: 'Servicios',
  requests: 'Solicitudes',
  invoices: 'Facturas',
  security: 'Seguridad',
}

export function PortalPreviewShell({
  access,
  reads,
  previewScenario,
  onSignOut,
}: PortalPreviewShellProps) {
  if (!reads || previewScenario === 'multi_client') {
    return <PortalShell access={access} onSignOut={onSignOut} />
  }

  return (
    <ConnectedPortalPreviewShell
      access={access}
      reads={reads}
      previewScenario={previewScenario}
      onSignOut={onSignOut}
    />
  )
}

function ConnectedPortalPreviewShell({
  access,
  reads,
  previewScenario,
  onSignOut,
}: PortalPreviewShellProps & { reads: PortalReadAdapter }) {
  const [dataState, setDataState] = useState<PortalDataState>({ status: 'loading' })
  const currentPage = resolvePortalPage(window.location.pathname)

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      reads.getAccountContext(),
      reads.getDashboard(),
      reads.listProperties(),
      reads.listServices(),
      reads.listServiceRequests(),
      reads.listInvoices(),
    ])
      .then(([account, dashboard, properties, services, requests, invoices]) => {
        if (!isCurrent) return
        if (
          account.clientContextId !== access.selectedClientId
          || account.role !== access.membership.role
        ) {
          setDataState({ status: 'error' })
          return
        }

        setDataState({
          status: 'ready',
          data: { account, dashboard, properties, services, requests, invoices },
        })
      })
      .catch(() => {
        if (isCurrent) setDataState({ status: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [access.membership.role, access.selectedClientId, reads])

  function getHref(page: PortalPage) {
    const pathname = getPortalPagePath(page)
    return previewScenario
      ? `${pathname}?portalPreview=${encodeURIComponent(previewScenario)}`
      : pathname
  }

  const account = dataState.status === 'ready' ? dataState.data.account : null
  const pageLabel = currentPage ? portalPageLabels[currentPage] : 'Página no disponible'

  return (
    <div className="portal-shell">
      <a className="portal-skip-link" href="#portal-main">Saltar al contenido</a>
      <header className="portal-shell__header">
        <a className="portal-shell__brand" href={getHref('home')} aria-label="Ir al inicio del área de clientes">
          <img
            src="/branding/Costa_Clean-LOGO-AZUL.png"
            alt="Costa Clean"
            className="portal-shell__logo"
          />
          <span>Área de clientes</span>
        </a>
        <div className="portal-shell__context">
          <span className="portal-shell__page-label">{pageLabel}</span>
          <span className="portal-status portal-status--success">Acceso autorizado</span>
        </div>
      </header>

      <div className="portal-shell__layout">
        <aside className="portal-sidebar" aria-label="Navegación del área de clientes">
          <div className="portal-sidebar__account">
            <span className="portal-sidebar__account-label">Cuenta</span>
            <strong>{account?.clientDisplayName ?? 'Preparando cuenta…'}</strong>
            <span>
              {access.membership.role === 'client_admin'
                ? 'Administrador del cliente'
                : 'Miembro del cliente'}
            </span>
          </div>
          <nav className="portal-sidebar__nav">
            {portalNavigationItems.map((item) => (
              <a
                key={item.page}
                href={getHref(item.page)}
                className={currentPage === item.page ? 'portal-nav-link is-active' : 'portal-nav-link'}
                aria-current={currentPage === item.page ? 'page' : undefined}
              >
                <span className="portal-nav-link__dot" aria-hidden="true" />
                {item.label}
              </a>
            ))}
          </nav>
          <p className="portal-sidebar__trust">
            Esta preview sintética no carga módulos internos del CRM.
          </p>
          <button type="button" className="portal-text-button" onClick={onSignOut}>
            Cerrar sesión
          </button>
        </aside>

        <main id="portal-main" className="portal-main" tabIndex={-1}>
          {dataState.status === 'loading' ? (
            <PortalPageLoading />
          ) : dataState.status === 'error' ? (
            <PortalPageError />
          ) : (
            <PortalPages page={currentPage} data={dataState.data} getHref={getHref} />
          )}
        </main>
      </div>
      <MobilePortalNavigation
        currentPage={currentPage}
        getHref={getHref}
        onSignOut={onSignOut}
      />
    </div>
  )
}

function MobilePortalNavigation({
  currentPage,
  getHref,
  onSignOut,
}: {
  currentPage: PortalPage | null
  getHref: (page: PortalPage) => string
  onSignOut: () => void
}) {
  const primaryItems = portalNavigationItems.filter((item) => item.group === 'primary')
  const moreItems = portalNavigationItems.filter((item) => item.group === 'more')
  const isMoreActive = moreItems.some((item) => item.page === currentPage)

  return (
    <nav className="portal-mobile-nav" aria-label="Navegación móvil del área de clientes">
      {primaryItems.map((item) => (
        <a
          key={item.page}
          href={getHref(item.page)}
          className={currentPage === item.page ? 'portal-mobile-nav__link is-active' : 'portal-mobile-nav__link'}
          aria-current={currentPage === item.page ? 'page' : undefined}
        >
          <span className="portal-mobile-nav__mark" aria-hidden="true" />
          {item.shortLabel}
        </a>
      ))}
      <details className="portal-mobile-more">
        <summary className={isMoreActive ? 'portal-mobile-nav__link is-active' : 'portal-mobile-nav__link'}>
          <span className="portal-mobile-nav__mark" aria-hidden="true" />
          Más
        </summary>
        <div className="portal-mobile-more__panel">
          <strong>Más opciones</strong>
          {moreItems.map((item) => (
            <a
              key={item.page}
              href={getHref(item.page)}
              className={currentPage === item.page ? 'portal-mobile-more__link is-active' : 'portal-mobile-more__link'}
              aria-current={currentPage === item.page ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            className="portal-mobile-more__link portal-mobile-more__signout"
            onClick={onSignOut}
          >
            Cerrar sesión
          </button>
        </div>
      </details>
    </nav>
  )
}

function PortalPageLoading() {
  return (
    <section className="portal-page-state" aria-busy="true">
      <span className="portal-loading-mark portal-loading-mark--small" aria-hidden="true">
        <span /><span /><span />
      </span>
      <div role="status" aria-live="polite">
        <h1>Preparando esta vista</h1>
        <p>Cargando únicamente el contexto sintético de esta preview local.</p>
      </div>
    </section>
  )
}

function PortalPageError() {
  return (
    <section className="portal-page-state portal-page-state--error" role="alert">
      <span className="portal-status portal-status--danger">Error seguro</span>
      <h1>No hemos podido cargar esta vista</h1>
      <p>No mostramos detalles técnicos ni información de otros clientes.</p>
    </section>
  )
}
