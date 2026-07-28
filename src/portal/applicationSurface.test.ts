import { describe, expect, it } from 'vitest'
import {
  isPortalPath,
  normalizeApplicationPathname,
  resolveApplicationSurface,
} from './applicationSurface'

describe('application surface isolation', () => {
  it('normalizes root and trailing slashes without broad prefix matching', () => {
    expect(normalizeApplicationPathname('')).toBe('/')
    expect(normalizeApplicationPathname('/portal/')).toBe('/portal')
    expect(normalizeApplicationPathname('portal/profile/')).toBe('/portal/profile')
  })

  it('routes the portal root and every portal subroute to the portal surface', () => {
    expect(isPortalPath('/portal')).toBe(true)
    expect(isPortalPath('/portal/')).toBe(true)
    expect(isPortalPath('/portal/properties')).toBe(true)
    expect(resolveApplicationSurface('/portal/invoices')).toBe('portal')
  })

  it('never treats similar CRM or unknown paths as portal routes', () => {
    expect(isPortalPath('/portal-admin')).toBe(false)
    expect(isPortalPath('/portals')).toBe(false)
    expect(resolveApplicationSurface('/clients')).toBe('crm')
    expect(resolveApplicationSurface('/')).toBe('crm')
  })
})
