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

export type PortalPage = (typeof portalPages)[number]

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

const portalPathByPage: Record<PortalPage, string> = {
  home: '/portal',
  profile: '/portal/profile',
  properties: '/portal/properties',
  services: '/portal/services',
  requests: '/portal/requests',
  invoices: '/portal/invoices',
  security: '/portal/security',
}

export function resolvePortalPage(pathname: string): PortalPage | null {
  return portalPageByPath.get(normalizeApplicationPathname(pathname)) ?? null
}

export function getPortalPagePath(page: PortalPage): string {
  return portalPathByPage[page]
}
