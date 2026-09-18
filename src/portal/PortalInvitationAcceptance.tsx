import {
  useEffect,
  useRef,
  useState,
} from 'react'
import type { PortalLifecycleResolution } from './contracts'
import { PortalBrand } from './PortalBrand'
import { PortalMotionSurface } from './PortalMotionSurface'

type InvitationResult = 'pending' | 'accepting' | 'accepted' | 'unavailable' | 'failed'

interface PortalInvitationAcceptanceProps {
  accessState: PortalLifecycleResolution
  token: string | null
  onAccept(token: string): Promise<void>
  onAccepted(): void
  onSignOut(): void
}

export function PortalInvitationAcceptance({
  accessState,
  token,
  onAccept,
  onAccepted,
  onSignOut,
}: PortalInvitationAcceptanceProps) {
  const [result, setResult] = useState<InvitationResult>(token ? 'pending' : 'unavailable')
  const attemptedToken = useRef<string | null>(null)

  const hasAuthenticatedSession = accessState.status !== 'unauthenticated'
    && accessState.status !== 'password_recovery'
    && accessState.status !== 'session_expired'
    && accessState.status !== 'booting'
    && accessState.status !== 'error'

  useEffect(() => {
    if (!token || !hasAuthenticatedSession || attemptedToken.current === token) return

    attemptedToken.current = token
    let cancelled = false

    void Promise.resolve().then(async () => {
      if (cancelled) return
      setResult('accepting')

      try {
        await onAccept(token)
        if (cancelled) return
        setResult('accepted')
        onAccepted()
      } catch {
        if (cancelled) return
        // The trusted boundary intentionally returns no invitation-specific
        // reason. A generic state prevents existence and status disclosure.
        setResult('unavailable')
      }
    })

    return () => {
      cancelled = true
    }
  }, [hasAuthenticatedSession, onAccept, onAccepted, token])

  if (!token || result === 'unavailable') {
    return <InvitationStatePanel state="unavailable" onSignOut={onSignOut} />
  }

  if (result === 'failed' || accessState.status === 'error') {
    return <InvitationStatePanel state="failed" onSignOut={onSignOut} />
  }

  if (result === 'accepting' || result === 'accepted' || accessState.status === 'booting') {
    return <InvitationStatePanel state="accepting" onSignOut={onSignOut} />
  }

  return <InvitationStatePanel state="authentication_required" onSignOut={onSignOut} />
}

function InvitationStatePanel({
  state,
  onSignOut,
}: {
  state: 'accepting' | 'authentication_required' | 'unavailable' | 'failed'
  onSignOut: () => void
}) {
  const content = invitationContent[state]

  return (
    <main className="portal-access" aria-busy={state === 'accepting'}>
      <PortalMotionSurface stateKey={`invitation-${state}`}>
        <section className="portal-access__panel">
          <PortalBrand />
          <div className="portal-access__copy" role={state === 'unavailable' ? 'alert' : 'status'} aria-live="polite">
            <span className={`portal-status portal-status--${content.tone}`}>{content.badge}</span>
            <p className="portal-eyebrow">Área de clientes</p>
            <h1>{content.title}</h1>
            <p>{content.description}</p>
          </div>
          {state === 'authentication_required' || state === 'failed' ? (
            <div className="portal-access__actions">
              <button type="button" className="portal-text-button" onClick={onSignOut}>
                Volver a iniciar sesión
              </button>
            </div>
          ) : null}
          <p className="portal-access__privacy-note">
            La invitación se valida solo después de iniciar sesión con la cuenta invitada.
          </p>
        </section>
      </PortalMotionSurface>
    </main>
  )
}

const invitationContent = {
  accepting: {
    badge: 'Comprobando acceso',
    tone: 'info',
    title: 'Validando tu invitación',
    description: 'Estamos preparando tu acceso de forma segura.',
  },
  authentication_required: {
    badge: 'Inicio de sesión necesario',
    tone: 'info',
    title: 'Inicia sesión para continuar',
    description: 'Usa la cuenta a la que se envió la invitación.',
  },
  unavailable: {
    badge: 'Invitación no disponible',
    tone: 'warning',
    title: 'No podemos usar esta invitación',
    description: 'Solicita una nueva invitación a Costa Clean para continuar.',
  },
  failed: {
    badge: 'No disponible ahora',
    tone: 'warning',
    title: 'No hemos podido validar la invitación',
    description: 'Vuelve a iniciar sesión o solicita una nueva invitación a Costa Clean.',
  },
} as const
