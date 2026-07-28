export type ApplicationSurface = 'crm' | 'portal'

export function normalizeApplicationPathname(pathname: string): string {
  const trimmedPath = pathname.trim()

  if (!trimmedPath || trimmedPath === '/') {
    return '/'
  }

  const withLeadingSlash = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

export function isPortalPath(pathname: string): boolean {
  const normalizedPath = normalizeApplicationPathname(pathname)
  return normalizedPath === '/portal' || normalizedPath.startsWith('/portal/')
}

export function resolveApplicationSurface(pathname: string): ApplicationSurface {
  return isPortalPath(pathname) ? 'portal' : 'crm'
}
