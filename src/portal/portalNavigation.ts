import { normalizeApplicationPathname } from './applicationSurface'

export const portalPages = [
  'home',
  'account',
  'profile',
  'properties',
  'services',
  'documents',
  'requests',
  'invoices',
  'security',
  'preferences',
  'help',
] as const

export const portalAuthRoutes = ['login', 'recover', 'reset-password'] as const

export type PortalPage = (typeof portalPages)[number]
export type PortalAuthRoute = (typeof portalAuthRoutes)[number]

const portalPageByPath = new Map<string, PortalPage>([
  ['/portal', 'home'],
  ['/portal/home', 'home'],
  ['/portal/account', 'account'],
  ['/portal/profile', 'profile'],
  ['/portal/properties', 'properties'],
  ['/portal/services', 'services'],
  ['/portal/documents', 'documents'],
  ['/portal/requests', 'requests'],
  ['/portal/invoices', 'invoices'],
  ['/portal/security', 'security'],
  ['/portal/preferences', 'preferences'],
  ['/portal/help', 'help'],
])

const portalLegacyPageAliases = new Map<string, PortalPage>([
  ['/portal/invoices', 'documents'],
  ['/portal/requests', 'profile'],
])

const portalAuthRouteByPath = new Map<string, PortalAuthRoute>([
  ['/portal/login', 'login'],
  ['/portal/recover', 'recover'],
  ['/portal/reset-password', 'reset-password'],
])

const portalPathByPage: Record<PortalPage, string> = {
  home: '/portal',
  account: '/portal/account',
  profile: '/portal/profile',
  properties: '/portal/properties',
  services: '/portal/services',
  documents: '/portal/documents',
  requests: '/portal/requests',
  invoices: '/portal/invoices',
  security: '/portal/security',
  preferences: '/portal/preferences',
  help: '/portal/help',
}

const portalPathByAuthRoute: Record<PortalAuthRoute, string> = {
  login: '/portal/login',
  recover: '/portal/recover',
  'reset-password': '/portal/reset-password',
}

export function resolvePortalPage(pathname: string): PortalPage | null {
  const normalizedPath = normalizeApplicationPathname(pathname)
  return portalLegacyPageAliases.get(normalizedPath)
    ?? portalPageByPath.get(normalizedPath)
    ?? resolveNestedPortalPage(normalizedPath)
    ?? null
}

export function resolvePortalAuthRoute(pathname: string): PortalAuthRoute | null {
  return portalAuthRouteByPath.get(normalizeApplicationPathname(pathname)) ?? null
}

export function getPortalPagePath(page: PortalPage): string {
  return portalPathByPage[page]
}

export function getPortalAuthPath(route: PortalAuthRoute): string {
  return portalPathByAuthRoute[route]
}

function resolveNestedPortalPage(pathname: string): PortalPage | null {
  if (pathname.startsWith('/portal/profile/')) return 'profile'
  if (pathname.startsWith('/portal/properties/')) return 'properties'
  return null
}
