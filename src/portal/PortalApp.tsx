import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  initialPortalAccessState,
  reducePortalAccessState,
} from './accessMachine'
import type {
  PortalLifecycleResolution,
  PortalRuntimeAdapter,
} from './contracts'
import { PortalAccessScreen } from './PortalAccessScreen'
import { PortalAuthScreen } from './PortalAuthScreen'
import { PortalShell } from './PortalShell'
import type { PortalShellProps } from './PortalShell'
import { PortalOnboardingFlow } from './PortalOnboardingFlow'
import { PortalInvitationAcceptance } from './PortalInvitationAcceptance'
import { acceptPortalInvitation } from './adapters/portalAccountActions'
import {
  getPortalAuthPath,
  resolvePortalAuthRoute,
} from './portalNavigation'
import { isPortalInvitationAcceptancePath } from './invitationAcceptance'

interface PortalAppProps {
  adapter: PortalRuntimeAdapter
  authenticatedSurface?: ComponentType<
    PortalShellProps & Pick<PortalRuntimeAdapter, 'reads' | 'previewScenario'>
  >
  previewControl?: ReactNode
  invitationToken?: string | null
}

export function PortalApp({
  adapter,
  authenticatedSurface: AuthenticatedSurface,
  previewControl = null,
  invitationToken: initialInvitationToken = null,
}: PortalAppProps) {
  const [accessState, dispatch] = useReducer(
    reducePortalAccessState,
    initialPortalAccessState,
  )
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [invitationToken, setInvitationToken] = useState(initialInvitationToken)
  const invitationRouteActive = isPortalInvitationAcceptancePath(pathname) || invitationToken !== null

  const navigate = useCallback(
    (nextPathname: string, replace = false) => {
      const url = resolveDecoratedPortalUrl(adapter.decoratePath(nextPathname))
      if (!url) return
      const nextUrl = `${url.pathname}${url.search}`
      if (replace) {
        window.history.replaceState(null, '', nextUrl)
      } else {
        window.history.pushState(null, '', nextUrl)
      }
      setPathname(url.pathname)
      window.scrollTo({ left: 0, top: 0 })
    },
    [adapter],
  )

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    return adapter.lifecycle.start((resolution: PortalLifecycleResolution) => {
      dispatch({ type: 'LIFECYCLE_RESOLVED', resolution })

      if (resolution.status === 'password_recovery') {
        const resetPath = getPortalAuthPath('reset-password')
        const resetUrl = resolveDecoratedPortalUrl(adapter.decoratePath(resetPath))
        if (!resetUrl) return
        window.history.replaceState(null, '', `${resetUrl.pathname}${resetUrl.search}`)
        setPathname(resetPath)
        return
      }

      const currentAuthRoute = resolvePortalAuthRoute(window.location.pathname)
      if (
        resolution.status === 'unauthenticated'
        && currentAuthRoute !== 'login'
        && currentAuthRoute !== 'recover'
      ) {
        const loginPath = getPortalAuthPath('login')
        const loginUrl = resolveDecoratedPortalUrl(adapter.decoratePath(loginPath))
        if (!loginUrl) return
        window.history.replaceState(null, '', `${loginUrl.pathname}${loginUrl.search}`)
        setPathname(loginPath)
        return
      }

      if (
        resolution.status !== 'unauthenticated'
        && resolution.status !== 'booting'
        && resolution.status !== 'session_expired'
        && currentAuthRoute
      ) {
        const portalUrl = resolveDecoratedPortalUrl(adapter.decoratePath('/portal'))
        if (!portalUrl) return
        window.history.replaceState(null, '', `${portalUrl.pathname}${portalUrl.search}`)
        setPathname('/portal')
      }
    })
  }, [adapter])

  const authRoute = resolvePortalAuthRoute(pathname)

  async function handleSignOut() {
    await adapter.lifecycle.signOut()
    navigate(getPortalAuthPath('login'), true)
  }

  let content: ReactNode
  if (invitationRouteActive && accessState.status !== 'unauthenticated' && accessState.status !== 'password_recovery') {
    content = (
      <PortalInvitationAcceptance
        accessState={accessState}
        token={invitationToken}
        onAccept={acceptPortalInvitation}
        onAccepted={() => {
          setInvitationToken(null)
          adapter.lifecycle.retry()
          navigate('/portal', true)
        }}
        onSignOut={handleSignOut}
      />
    )
  } else if (accessState.status === 'active_member') {
    content = AuthenticatedSurface && adapter.previewScenario ? (
      <AuthenticatedSurface
        access={accessState}
        reads={adapter.reads}
        previewScenario={adapter.previewScenario}
        onSignOut={handleSignOut}
      />
    ) : (
      <PortalShell access={accessState} onSignOut={handleSignOut} />
    )
  } else if (
    accessState.status === 'unauthenticated'
    || accessState.status === 'password_recovery'
  ) {
    content = (
      <PortalAuthScreen
        lifecycle={adapter.lifecycle}
        route={
          accessState.status === 'password_recovery'
            ? 'reset-password'
            : authRoute === 'recover'
              ? 'recover'
              : 'login'
        }
        onNavigate={navigate}
        notice={invitationToken
          ? 'Inicia sesión con la cuenta invitada. Si continúas con Google, vuelve a abrir el enlace después de autenticarte.'
          : undefined}
      />
    )
  } else if (accessState.status === 'authenticated_without_access') {
    content = <PortalOnboardingFlow onSignOut={handleSignOut} />
  } else {
    content = (
      <PortalAccessScreen
        state={accessState}
        onRetry={() => adapter.lifecycle.retry()}
        onSignOut={handleSignOut}
        onSelectMembership={(membership) =>
          dispatch({ type: 'CLIENT_SELECTED', membership })}
      />
    )
  }

  return (
    <div
      className={
        adapter.previewScenario
          ? 'portal-root portal-root--preview'
          : 'portal-root'
      }
    >
      {previewControl}
      {content}
    </div>
  )
}

function resolveDecoratedPortalUrl(pathname: string) {
  const url = new URL(pathname, window.location.origin)
  if (
    url.origin !== window.location.origin
    || (url.pathname !== '/portal' && !url.pathname.startsWith('/portal/'))
  ) {
    return null
  }
  return url
}
