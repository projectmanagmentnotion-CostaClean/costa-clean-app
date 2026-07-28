import type { PortalAccessState } from './accessMachine'

interface PortalAccessScreenProps {
  state: Exclude<PortalAccessState, { status: 'authenticated' }>
}

const accessStateContent = {
  unauthenticated: {
    eyebrow: 'Área de clientes',
    title: 'Tu acceso seguro empieza aquí',
    description:
      'La ruta del portal ya está aislada. El inicio de sesión real se habilitará en la siguiente fase; todavía no solicitamos credenciales.',
    badge: 'Acceso todavía no habilitado',
    tone: 'info',
  },
  pending_review: {
    eyebrow: 'Solicitud recibida',
    title: 'Estamos revisando tu acceso',
    description:
      'Tu solicitud sigue pendiente de validación. Hasta que Costa Clean la apruebe, no se muestra información de clientes ni servicios.',
    badge: 'Pendiente de revisión',
    tone: 'warning',
  },
  suspended: {
    eyebrow: 'Acceso temporalmente limitado',
    title: 'Tu cuenta está suspendida',
    description:
      'No podemos mostrar información del portal en este momento. Contacta con Costa Clean por los canales habituales para revisar tu acceso.',
    badge: 'Sin acceso a datos',
    tone: 'warning',
  },
  revoked: {
    eyebrow: 'Acceso finalizado',
    title: 'Tu acceso ha sido revocado',
    description:
      'La sesión no tiene una membresía activa. No se ha cargado información del cliente ni de sus documentos.',
    badge: 'Membresía inactiva',
    tone: 'danger',
  },
  forbidden: {
    eyebrow: 'Área protegida',
    title: 'No tienes permiso para ver este contenido',
    description:
      'No podemos confirmar si el recurso existe. Revisa el acceso con Costa Clean si crees que se trata de un error.',
    badge: 'Acceso denegado',
    tone: 'danger',
  },
} as const

export function PortalAccessScreen({ state }: PortalAccessScreenProps) {
  if (state.status === 'booting') {
    return (
      <main className="portal-access" aria-busy="true" aria-label="Preparando el área de clientes">
        <section className="portal-access__panel portal-access__panel--loading">
          <PortalBrand />
          <div className="portal-loading-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="portal-access__copy" role="status" aria-live="polite">
            <p className="portal-eyebrow">Área de clientes</p>
            <h1>Preparando tu espacio</h1>
            <p>Comprobando el estado de acceso sin cargar datos del CRM.</p>
          </div>
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-access">
        <section className="portal-access__panel">
          <PortalBrand />
          <div className="portal-access__copy" role="alert">
            <span className="portal-status portal-status--danger">No disponible</span>
            <p className="portal-eyebrow">Área de clientes</p>
            <h1>No hemos podido preparar tu espacio</h1>
            <p>{state.message}</p>
          </div>
          <button
            type="button"
            className="portal-button portal-button--primary"
            onClick={() => window.location.reload()}
          >
            Volver a intentarlo
          </button>
        </section>
      </main>
    )
  }

  const content = accessStateContent[state.status]

  return (
    <main className="portal-access">
      <section className="portal-access__panel">
        <PortalBrand />
        <div className="portal-access__copy">
          <span className={`portal-status portal-status--${content.tone}`}>
            {content.badge}
          </span>
          <p className="portal-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <p className="portal-access__privacy-note">
          El portal nunca vincula una cuenta a un cliente por coincidencia de email.
        </p>
      </section>
    </main>
  )
}

function PortalBrand() {
  return (
    <div className="portal-brand">
      <img
        src="/branding/Costa_Clean-LOGO-AZUL.png"
        alt="Costa Clean"
        className="portal-brand__logo"
      />
      <span className="portal-brand__surface">Área de clientes</span>
    </div>
  )
}
