import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import type {
  PortalLifecycleResolution,
  PortalMembershipContext,
} from './contracts'
import { PortalBrand } from './PortalBrand'
import { PortalMotionSurface } from './PortalMotionSurface'

interface PortalAccessScreenProps {
  state: Exclude<
    PortalLifecycleResolution,
    { status: 'active_member' | 'unauthenticated' | 'password_recovery' }
  >
  onRetry: () => void
  onSignOut: () => void
  onSelectMembership: (membership: PortalMembershipContext) => void
}

const accessStateContent = {
  pending_review: {
    eyebrow: 'Solicitud recibida',
    title: 'Estamos revisando tu acceso',
    description:
      'Tu solicitud sigue pendiente de validación. Hasta que Costa Clean la apruebe, no mostramos información de clientes ni servicios.',
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
  authenticated_without_access: {
    eyebrow: 'Área protegida',
    title: 'Tu cuenta todavía no tiene acceso',
    description:
      'No podemos mostrar recursos del portal. Costa Clean debe validar y asignar el acceso mediante una membresía explícita.',
    badge: 'Acceso no asignado',
    tone: 'danger',
  },
  session_expired: {
    eyebrow: 'Sesión finalizada',
    title: 'Tu sesión ha terminado',
    description:
      'Por seguridad hemos retirado el contenido protegido. Vuelve a iniciar sesión para continuar.',
    badge: 'Sesión cerrada',
    tone: 'warning',
  },
} as const

export function PortalAccessScreen({
  state,
  onRetry,
  onSignOut,
  onSelectMembership,
}: PortalAccessScreenProps) {
  if (state.status === 'booting') {
    return (
      <main className="portal-access" aria-busy="true" aria-label="Preparando el área de clientes">
        <PortalMotionSurface stateKey="booting">
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
        </PortalMotionSurface>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <PortalStatePanel
        stateKey="error"
        badge="No disponible"
        tone="danger"
        eyebrow="Área de clientes"
        title="No hemos podido preparar tu espacio"
        description={state.message}
      >
        <button type="button" className="portal-button portal-button--primary" onClick={onRetry}>
          Volver a intentarlo
        </button>
      </PortalStatePanel>
    )
  }

  if (state.status === 'client_selection_required') {
    return (
      <PortalStatePanel
        stateKey="client-selection"
        badge="Selección necesaria"
        tone="info"
        eyebrow="Más de una cuenta disponible"
        title="Elige dónde quieres entrar"
        description="La elección solo se conserva durante esta sesión. No seleccionamos una cuenta automáticamente."
      >
        <ul className="portal-account-choice" aria-label="Cuentas disponibles">
          {state.memberships.map((membership, index) => (
            <li key={membership.membershipId}>
              <button
                type="button"
                className="portal-account-choice__button"
                onClick={() => onSelectMembership(membership)}
              >
                <span>
                  <strong>Cuenta {index + 1}</strong>
                  <small>
                    {membership.role === 'client_admin'
                      ? 'Administrador del cliente'
                      : 'Miembro del cliente'}
                  </small>
                </span>
                <span aria-hidden="true">Continuar</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="portal-text-button" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </PortalStatePanel>
    )
  }

  const content = accessStateContent[state.status]
  return (
    <PortalStatePanel
      stateKey={state.status}
      badge={content.badge}
      tone={content.tone}
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
    >
      {state.status === 'session_expired' ? (
        <button
          type="button"
          className="portal-button portal-button--primary"
          onClick={onSignOut}
        >
          Volver a iniciar sesión
        </button>
      ) : (
        <button type="button" className="portal-text-button" onClick={onSignOut}>
          Cerrar sesión
        </button>
      )}
    </PortalStatePanel>
  )
}

function PortalStatePanel({
  stateKey,
  badge,
  tone,
  eyebrow,
  title,
  description,
  children,
}: {
  stateKey: string
  badge: string
  tone: 'info' | 'warning' | 'danger'
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isUrgent =
    stateKey === 'error'
    || stateKey === 'revoked'
    || stateKey === 'session_expired'
    || stateKey === 'suspended'

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [stateKey])

  return (
    <main className="portal-access">
      <PortalMotionSurface stateKey={stateKey}>
        <section className="portal-access__panel">
          <PortalBrand />
          <div
            className="portal-access__copy"
            role={isUrgent ? 'alert' : 'status'}
            aria-live={isUrgent ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <span className={`portal-status portal-status--${tone}`}>{badge}</span>
            <p className="portal-eyebrow">{eyebrow}</p>
            <h1 ref={titleRef} tabIndex={-1}>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="portal-access__actions">{children}</div>
          <p className="portal-access__privacy-note">
            El portal nunca vincula una cuenta a un cliente por coincidencia de email.
          </p>
        </section>
      </PortalMotionSurface>
    </main>
  )
}
