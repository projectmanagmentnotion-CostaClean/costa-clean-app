import { normalizeApplicationPathname } from './applicationSurface'

export const portalPages = [
  'home',
  'account',
  'profile',
  'properties',
  'services',
  'service-requests',
  'documents',
  'requests',
  'invoices',
  'security',
  'preferences',
  'help',
] as const

export const portalAuthRoutes = ['login', 'recover', 'reset-password'] as const

export interface PortalPropertyRoute {
  publicRef: string
  step: 'fields' | 'values' | 'review' | 'success' | null
}

export interface PortalServiceRoute {
  serviceRef: string
}

export interface PortalRequestRoute {
  scope: 'profile' | 'property'
  propertyRef: string | null
  reference: string | null
}

export interface PortalServiceRequestRoute {
  reference: string | null
  step: 'property' | 'service' | 'date' | 'details' | 'review' | 'success' | null
}

export type PortalPage = (typeof portalPages)[number]
export type PortalAuthRoute = (typeof portalAuthRoutes)[number]

const portalPageByPath = new Map<string, PortalPage>([
  ['/portal', 'home'],
  ['/portal/home', 'home'],
  ['/portal/account', 'account'],
  ['/portal/profile', 'profile'],
  ['/portal/properties', 'properties'],
  ['/portal/services', 'services'],
  ['/portal/service-requests', 'service-requests'],
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
  'service-requests': '/portal/service-requests',
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

export function getPortalPropertyPath(publicRef: string): string {
  return `/portal/properties/${publicRef}`
}

export function getPortalServicePath(serviceRef: string): string {
  return `/portal/services/${serviceRef}`
}

export function getPortalServiceRequestsPath(): string {
  return '/portal/service-requests'
}

export function getPortalServiceRequestPath(reference: string): string {
  return `${getPortalServiceRequestsPath()}/${reference}`
}

export function getPortalServiceRequestNewPath(step: 'property' | 'service' | 'date' | 'details' | 'review' | 'success'): string {
  return `${getPortalServiceRequestsPath()}/new/${step}`
}

export function getPortalProfileRequestsPath(): string {
  return '/portal/profile/requests'
}

export function getPortalProfileRequestPath(reference: string): string {
  return `${getPortalProfileRequestsPath()}/${reference}`
}

export function getPortalPropertyRequestsPath(publicRef: string): string {
  return `${getPortalPropertyPath(publicRef)}/requests`
}

export function getPortalPropertyRequestPath(publicRef: string, reference: string): string {
  return `${getPortalPropertyRequestsPath(publicRef)}/${reference}`
}

export function resolvePortalPropertyRoute(pathname: string): PortalPropertyRoute | null {
  const normalizedPath = normalizeApplicationPathname(pathname)
  if (!normalizedPath.startsWith('/portal/properties/')) return null

  const remainder = normalizedPath.slice('/portal/properties/'.length)
  const [publicRef = '', maybeCorrection, maybeStep] = remainder.split('/')
  if (!publicRef) return null
  if (maybeCorrection !== 'correction') {
    return { publicRef, step: null }
  }

  if (maybeStep === 'fields' || maybeStep === 'values' || maybeStep === 'review' || maybeStep === 'success') {
    return { publicRef, step: maybeStep }
  }

  return { publicRef, step: null }
}

export function resolvePortalServiceRoute(pathname: string): PortalServiceRoute | null {
  const normalizedPath = normalizeApplicationPathname(pathname)
  if (!normalizedPath.startsWith('/portal/services/')) return null

  const serviceRef = normalizedPath.slice('/portal/services/'.length).split('/')[0] ?? ''
  if (!serviceRef) return null
  return { serviceRef }
}

export function resolvePortalRequestRoute(pathname: string): PortalRequestRoute | null {
  const normalizedPath = normalizeApplicationPathname(pathname)

  if (normalizedPath === '/portal/profile/requests') {
    return { scope: 'profile', propertyRef: null, reference: null }
  }

  if (normalizedPath.startsWith('/portal/profile/requests/')) {
    const reference = normalizedPath.slice('/portal/profile/requests/'.length).split('/')[0] ?? ''
    if (!reference) return null
    return { scope: 'profile', propertyRef: null, reference }
  }

  if (!normalizedPath.startsWith('/portal/properties/')) return null

  const remainder = normalizedPath.slice('/portal/properties/'.length)
  const [propertyRef = '', maybeSection, maybeReference] = remainder.split('/')
  if (!propertyRef || maybeSection !== 'requests') return null

  if (!maybeReference) {
    return { scope: 'property', propertyRef, reference: null }
  }

  return { scope: 'property', propertyRef, reference: maybeReference }
}

export function resolvePortalServiceRequestRoute(pathname: string): PortalServiceRequestRoute | null {
  const normalizedPath = normalizeApplicationPathname(pathname)

  if (normalizedPath === '/portal/service-requests') {
    return { reference: null, step: null }
  }

  if (normalizedPath.startsWith('/portal/service-requests/new/')) {
    const step = normalizedPath.slice('/portal/service-requests/new/'.length).split('/')[0] ?? ''
    if (!step) return null
    if (step === 'property' || step === 'service' || step === 'date' || step === 'details' || step === 'review' || step === 'success') {
      return { reference: null, step }
    }
    return null
  }

  if (normalizedPath.startsWith('/portal/service-requests/')) {
    const reference = normalizedPath.slice('/portal/service-requests/'.length).split('/')[0] ?? ''
    if (!reference || reference === 'new') return null
    return { reference, step: null }
  }

  return null
}

function resolveNestedPortalPage(pathname: string): PortalPage | null {
  if (pathname.startsWith('/portal/profile/')) return 'profile'
  if (pathname.startsWith('/portal/properties/')) return 'properties'
  if (pathname.startsWith('/portal/services/')) return 'services'
  if (pathname.startsWith('/portal/service-requests/')) return 'service-requests'
  return null
}
