import type { PortalAccessState } from './accessMachine'

type AuthenticatedPortalAccess = Extract<PortalAccessState, { status: 'active_member' }>

export interface PortalShellProps {
  access: AuthenticatedPortalAccess
  onSignOut: () => void
}

export function PortalShell({ access, onSignOut }: PortalShellProps) {
  return (
    <div className="portal-ready-shell">
      <a className="portal-skip-link" href="#portal-main">Saltar al contenido</a>
      <header className="portal-shell__header portal-ready-shell__header">
        <a className="portal-shell__brand" href="/portal" aria-label="Área de clientes">
          <img
            src="/branding/Costa_Clean-LOGO-AZUL.png"
            alt="Costa Clean"
            className="portal-shell__logo"
          />
          <span>Área de clientes</span>
        </a>
        <button type="button" className="portal-text-button" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </header>
      <main id="portal-main" className="portal-ready-shell__main" tabIndex={-1}>
        <section className="portal-ready-card">
          <span className="portal-status portal-status--success">Acceso autorizado</span>
          <p className="portal-eyebrow">Conexión segura preparada</p>
          <h1>Tu espacio está listo</h1>
          <p>
            Hemos verificado una membresía explícita como{' '}
            {access.membership.role === 'client_admin'
              ? 'administrador del cliente'
              : 'miembro del cliente'}
            . Los datos operativos se habilitarán únicamente mediante las vistas
            estrechas previstas para la siguiente fase.
          </p>
          <div className="portal-ready-card__boundary">
            <strong>Frontera activa</strong>
            <span>Sin acceso directo a tablas internas del CRM</span>
          </div>
        </section>
      </main>
    </div>
  )
}
