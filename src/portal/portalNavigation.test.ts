import { describe, expect, it } from 'vitest'
import {
  getPortalAuthPath,
  getPortalPagePath,
  getPortalPropertyPath,
  resolvePortalAuthRoute,
  resolvePortalPage,
  resolvePortalPropertyRoute,
} from './portalNavigation'

describe('portal page routing', () => {
  it('maps the portal root and base pages without query-based CRM navigation', () => {
    expect(resolvePortalPage('/portal')).toBe('home')
    expect(resolvePortalPage('/portal/')).toBe('home')
    expect(resolvePortalPage('/portal/properties')).toBe('properties')
    expect(resolvePortalPage('/portal/invoices/')).toBe('documents')
  })

  it('returns no page for unknown portal paths instead of falling through to CRM', () => {
    expect(resolvePortalPage('/portal/login')).toBeNull()
    expect(resolvePortalPage('/portal/clients')).toBeNull()
    expect(resolvePortalPage('/portal/admin')).toBeNull()
  })

  it('generates canonical portal paths for navigation', () => {
    expect(getPortalPagePath('home')).toBe('/portal')
    expect(getPortalPagePath('account')).toBe('/portal/account')
    expect(getPortalPagePath('requests')).toBe('/portal/requests')
    expect(getPortalPagePath('documents')).toBe('/portal/documents')
    expect(getPortalPagePath('security')).toBe('/portal/security')
  })

  it('isolates canonical authentication routes from protected pages', () => {
    expect(resolvePortalAuthRoute('/portal/login')).toBe('login')
    expect(resolvePortalAuthRoute('/portal/recover/')).toBe('recover')
    expect(resolvePortalAuthRoute('/portal/reset-password')).toBe('reset-password')
    expect(resolvePortalAuthRoute('/portal/invoices')).toBeNull()
    expect(getPortalAuthPath('reset-password')).toBe('/portal/reset-password')
  })

  it('maps legacy and nested portal routes to the correct workspace page', () => {
    expect(resolvePortalPage('/portal/invoices')).toBe('documents')
    expect(resolvePortalPage('/portal/profile/requests')).toBe('profile')
    expect(resolvePortalPage('/portal/profile/correction/review')).toBe('profile')
    expect(resolvePortalPage('/portal/properties/ref-espacio-norte/correction/success')).toBe('properties')
    expect(resolvePortalPage('/portal/help')).toBe('help')
    expect(resolvePortalPage('/portal/preferences')).toBe('preferences')
    expect(getPortalPropertyPath('ref-espacio-norte')).toBe('/portal/properties/ref-espacio-norte')
    expect(resolvePortalPropertyRoute('/portal/properties/ref-espacio-norte')).toEqual({
      publicRef: 'ref-espacio-norte',
      step: null,
    })
    expect(resolvePortalPropertyRoute('/portal/properties/ref-espacio-norte/correction/review')).toEqual({
      publicRef: 'ref-espacio-norte',
      step: 'review',
    })
  })
})
