import { describe, expect, it } from 'vitest'
import {
  getPortalAuthPath,
  getPortalPagePath,
  resolvePortalAuthRoute,
  resolvePortalPage,
} from './portalNavigation'

describe('portal page routing', () => {
  it('maps the portal root and base pages without query-based CRM navigation', () => {
    expect(resolvePortalPage('/portal')).toBe('home')
    expect(resolvePortalPage('/portal/')).toBe('home')
    expect(resolvePortalPage('/portal/properties')).toBe('properties')
    expect(resolvePortalPage('/portal/invoices/')).toBe('invoices')
  })

  it('returns no page for unknown portal paths instead of falling through to CRM', () => {
    expect(resolvePortalPage('/portal/login')).toBeNull()
    expect(resolvePortalPage('/portal/clients')).toBeNull()
    expect(resolvePortalPage('/portal/admin')).toBeNull()
  })

  it('generates canonical portal paths for navigation', () => {
    expect(getPortalPagePath('home')).toBe('/portal')
    expect(getPortalPagePath('requests')).toBe('/portal/requests')
    expect(getPortalPagePath('security')).toBe('/portal/security')
  })

  it('isolates canonical authentication routes from protected pages', () => {
    expect(resolvePortalAuthRoute('/portal/login')).toBe('login')
    expect(resolvePortalAuthRoute('/portal/recover/')).toBe('recover')
    expect(resolvePortalAuthRoute('/portal/reset-password')).toBe('reset-password')
    expect(resolvePortalAuthRoute('/portal/invoices')).toBeNull()
    expect(getPortalAuthPath('reset-password')).toBe('/portal/reset-password')
  })
})
