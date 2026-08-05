import { useMemo } from 'react'
import type { PortalAccessState } from './accessMachine'
import type { PortalPreviewScenario } from './contracts'
import { PortalPages } from './PortalPages'
import { getPortalPagePath, resolvePortalPage, type PortalPage } from './portalNavigation'
import type { PortalFoundationData } from './portalWorkspaceData'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export type PortalWorkspaceDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: PortalFoundationData }
  | { status: 'error' }

export interface PortalWorkspaceViewProps {
  access: AuthenticatedPortalAccess
  dataState: PortalWorkspaceDataState
  previewScenario: PortalPreviewScenario | null
  onSignOut: () => void
  onRefreshData?: () => void
}

const portalNavigationItems: Array<{
  page: PortalPage
  label: string
  shortLabel: string
  group: 'primary' | 'more'
}> = [
  { page: 'home', label: 'Inicio', shortLabel: 'Inicio', group: 'primary' },
  { page: 'services', label: 'Servicios', shortLabel: 'Servicios', group: 'primary' },
  { page: 'properties', label: 'Propiedades', shortLabel: 'Propiedades', group: 'primary' },
  { page: 'documents', label: 'Documentos', shortLabel: 'Documentos', group: 'primary' },
  { page: 'account', label: 'Cuenta', shortLabel: 'Cuenta', group: 'primary' },
  { page: 'profile', label: 'Perfil', shortLabel: 'Perfil', group: 'more' },
  { page: 'security', label: 'Seguridad', shortLabel: 'Seguridad', group: 'more' },
  { page: 'preferences', label: 'Preferencias', shortLabel: 'Preferencias', group: 'more' },
  { page: 'help', label: 'Ayuda', shortLabel: 'Ayuda', group: 'more' },
]

const portalPageLabels: Record<PortalPage, string> = {
  home: 'Inicio',
  account: 'Cuenta',
  profile: 'Perfil',
  properties: 'Propiedades',
  services: 'Servicios',
  documents: 'Documentos',
  requests: 'Solicitudes',
  invoices: 'Facturas',
  security: 'Seguridad',
  preferences: 'Preferencias',
  help: 'Ayuda',
}

export function PortalWorkspaceView({
  access,
  dataState,
  previewScenario,
  onSignOut,
  onRefreshData,
}: PortalWorkspaceViewProps) {
  const currentPage = resolvePortalPage(window.location.pathname)
  const pageLabel = currentPage ? portalPageLabels[currentPage] : 'Página no disponible'
  const workspaceData = dataState.status === 'ready' ? dataState.data : null
  const workspaceMode = dataState.status === 'ready'
    ? summarizeWorkspaceMode(dataState.data.capabilities)
    : dataState.status

  const getHref = useMemo(() => {
    return (page: PortalPage) => {
      const pathname = getPortalPagePath(page)
      return previewScenario
        ? `${pathname}?portalPreview=${encodeURIComponent(previewScenario)}`
        : pathname
    }
  }, [previewScenario])

  return (
    <div className="portal-workspace">
      <a className="portal-skip-link" href="#portal-main">Saltar al contenido</a>
      <header className="portal-workspace__header">
        <a className="portal-workspace__brand" href={getHref('home')} aria-label="Ir al inicio del área de clientes">
          <img
            src="/branding/Costa_Clean-LOGO-AZUL.png"
            alt="Costa Clean"
            className="portal-workspace__logo"
          />
          <span>Área de clientes</span>
        </a>
        <div className="portal-workspace__context">
          <span className="portal-workspace__page-label">{pageLabel}</span>
          <span className={`portal-status portal-status--${workspaceMode === 'error' ? 'danger' : workspaceMode === 'partial' || workspaceMode === 'loading' ? 'warning' : 'success'}`}>
            {workspaceMode === 'ready'
              ? 'Acceso autorizado'
              : workspaceMode === 'partial'
                ? 'Lectura parcial'
                : workspaceMode === 'loading'
                  ? 'Preparando'
                  : 'Error seguro'}
          </span>
        </div>
      </header>

      <div className="portal-workspace__layout">
        <aside className="portal-sidebar" aria-label="Navegación del área de clientes">
          <div className="portal-sidebar__account">
            <span className="portal-sidebar__account-label">Cuenta</span>
            <strong>{workspaceData ? workspaceData.account.clientDisplayName : 'Preparando cuenta…'}</strong>
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
            Este espacio no expone navegación ni tablas del CRM.
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
            <PortalPages
              page={currentPage}
              pathname={window.location.pathname}
              data={workspaceData!}
              getHref={getHref}
              onRefreshData={onRefreshData}
            />
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

function summarizeWorkspaceMode(capabilities: PortalFoundationData['capabilities']) {
  const statuses = [
    capabilities.profile.status,
    capabilities.properties.status,
    capabilities.profileRequests.status,
    capabilities.propertyRequests.status,
    capabilities.services.status,
    capabilities.serviceRequests.status,
    capabilities.invoices.status,
  ]
  if (statuses.includes('ERROR')) return 'error'
  if (statuses.includes('UNAVAILABLE')) return 'partial'
  return 'ready'
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
        <p>Cargando únicamente el contexto permitido para esta sección.</p>
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
