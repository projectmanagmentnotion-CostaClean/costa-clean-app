import { describe, expect, it } from 'vitest'
import {
  getPortalAuthPath,
  getPortalPagePath,
  getPortalProfileRequestPath,
  getPortalProfileRequestsPath,
  getPortalPropertyPath,
  getPortalPropertyRequestPath,
  getPortalPropertyRequestsPath,
  resolvePortalAuthRoute,
  resolvePortalPage,
  resolvePortalRequestRoute,
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
    expect(resolvePortalPage('/portal/profile/requests/CC-PR-0142')).toBe('profile')
    expect(resolvePortalPage('/portal/properties/ref-espacio-norte/requests')).toBe('properties')
    expect(resolvePortalPage('/portal/properties/ref-espacio-norte/requests/CC-PT-0318')).toBe('properties')
    expect(resolvePortalPage('/portal/profile/correction/review')).toBe('profile')
    expect(resolvePortalPage('/portal/properties/ref-espacio-norte/correction/success')).toBe('properties')
    expect(resolvePortalPage('/portal/help')).toBe('help')
    expect(resolvePortalPage('/portal/preferences')).toBe('preferences')
    expect(getPortalPropertyPath('ref-espacio-norte')).toBe('/portal/properties/ref-espacio-norte')
    expect(getPortalProfileRequestsPath()).toBe('/portal/profile/requests')
    expect(getPortalProfileRequestPath('CC-PR-0142')).toBe('/portal/profile/requests/CC-PR-0142')
    expect(getPortalPropertyRequestsPath('ref-espacio-norte')).toBe('/portal/properties/ref-espacio-norte/requests')
    expect(getPortalPropertyRequestPath('ref-espacio-norte', 'CC-PT-0318')).toBe(
      '/portal/properties/ref-espacio-norte/requests/CC-PT-0318',
    )
    expect(resolvePortalPropertyRoute('/portal/properties/ref-espacio-norte')).toEqual({
      publicRef: 'ref-espacio-norte',
      step: null,
    })
    expect(resolvePortalPropertyRoute('/portal/properties/ref-espacio-norte/correction/review')).toEqual({
      publicRef: 'ref-espacio-norte',
      step: 'review',
    })
    expect(resolvePortalRequestRoute('/portal/profile/requests')).toEqual({
      scope: 'profile',
      propertyRef: null,
      reference: null,
    })
    expect(resolvePortalRequestRoute('/portal/profile/requests/CC-PR-0142')).toEqual({
      scope: 'profile',
      propertyRef: null,
      reference: 'CC-PR-0142',
    })
    expect(resolvePortalRequestRoute('/portal/properties/ref-espacio-norte/requests')).toEqual({
      scope: 'property',
      propertyRef: 'ref-espacio-norte',
      reference: null,
    })
    expect(resolvePortalRequestRoute('/portal/properties/ref-espacio-norte/requests/CC-PT-0318')).toEqual({
      scope: 'property',
      propertyRef: 'ref-espacio-norte',
      reference: 'CC-PT-0318',
    })
  })
})
