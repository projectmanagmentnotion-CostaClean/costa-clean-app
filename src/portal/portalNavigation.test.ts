import { describe, expect, it } from 'vitest'
import { getPortalPagePath, resolvePortalPage } from './portalNavigation'

describe('portal page routing', () => {
  it('maps the portal root and base pages without query-based CRM navigation', () => {
    expect(resolvePortalPage('/portal')).toBe('home')
    expect(resolvePortalPage('/portal/')).toBe('home')
    expect(resolvePortalPage('/portal/properties')).toBe('properties')
    expect(resolvePortalPage('/portal/invoices/')).toBe('invoices')
  })

  it('returns no page for unknown portal paths instead of falling through to CRM', () => {
    expect(resolvePortalPage('/portal/clients')).toBeNull()
    expect(resolvePortalPage('/portal/admin')).toBeNull()
  })

  it('generates canonical portal paths for navigation', () => {
    expect(getPortalPagePath('home')).toBe('/portal')
    expect(getPortalPagePath('requests')).toBe('/portal/requests')
    expect(getPortalPagePath('security')).toBe('/portal/security')
  })
})
