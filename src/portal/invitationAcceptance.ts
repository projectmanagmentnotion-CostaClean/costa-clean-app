import { normalizeApplicationPathname } from './applicationSurface'

export const portalInvitationAcceptancePath = '/portal/invitacion'

const invitationTokenPattern = /^[A-Za-z0-9_-]{43,128}$/u

export function isPortalInvitationAcceptancePath(pathname: string): boolean {
  return normalizeApplicationPathname(pathname) === portalInvitationAcceptancePath
}

export function readPortalInvitationToken(hash: string): string | null {
  if (!hash.startsWith('#')) return null

  const fragment = hash.slice(1)
  if (!fragment) return null

  const parameters = new URLSearchParams(fragment)
  const tokens = parameters.getAll('token')

  if (parameters.size !== 1 || tokens.length !== 1) return null

  const [token] = tokens
  return token && invitationTokenPattern.test(token) ? token : null
}

export function takePortalInvitationToken(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState'>,
): string | null {
  if (!isPortalInvitationAcceptancePath(location.pathname)) return null

  const token = readPortalInvitationToken(location.hash)

  // Remove every fragment before the app starts auth so a token cannot persist
  // in browser history, referrers or copied URLs after the initial click.
  if (location.hash) {
    history.replaceState(null, '', `${portalInvitationAcceptancePath}${location.search}`)
  }

  return token
}
