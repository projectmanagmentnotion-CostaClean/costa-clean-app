import { normalizeApplicationPathname } from './applicationSurface'

export const portalPages = [
  'home',
  'profile',
  'properties',
  'services',
  'requests',
  'invoices',
  'security',
] as const

export const portalAuthRoutes = ['login', 'recover', 'reset-password'] as const

export type PortalPage = (typeof portalPages)[number]
export type PortalAuthRoute = (typeof portalAuthRoutes)[number]

const portalPageByPath = new Map<string, PortalPage>([
  ['/portal', 'home'],
  ['/portal/home', 'home'],
  ['/portal/profile', 'profile'],
  ['/portal/properties', 'properties'],
  ['/portal/services', 'services'],
  ['/portal/requests', 'requests'],
  ['/portal/invoices', 'invoices'],
  ['/portal/security', 'security'],
])

const portalAuthRouteByPath = new Map<string, PortalAuthRoute>([
  ['/portal/login', 'login'],
  ['/portal/recover', 'recover'],
  ['/portal/reset-password', 'reset-password'],
])

const portalPathByPage: Record<PortalPage, string> = {
  home: '/portal',
  profile: '/portal/profile',
  properties: '/portal/properties',
  services: '/portal/services',
  requests: '/portal/requests',
  invoices: '/portal/invoices',
  security: '/portal/security',
}

const portalPathByAuthRoute: Record<PortalAuthRoute, string> = {
  login: '/portal/login',
  recover: '/portal/recover',
  'reset-password': '/portal/reset-password',
}

export function resolvePortalPage(pathname: string): PortalPage | null {
  return portalPageByPath.get(normalizeApplicationPathname(pathname)) ?? null
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
