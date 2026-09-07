import { describe, expect, it } from 'vitest'
import {
  appNavigationViews,
  isAppNavigationItemActive,
  mobilePrimaryNavigationViews,
  mobileSecondaryNavigationViews,
} from './navigation'

describe('AppNav navigation model', () => {
  it('keeps every real destination in the desktop navigation model', () => {
    expect(appNavigationViews).toEqual([
      'dashboard',
      'leads',
      'clients',
      'properties',
      'quotes',
      'jobs',
      'invoices',
      'payments',
      'expenses',
      'fiscal_closing',
    ])
  })

  it('keeps mobile primary and secondary destinations separate', () => {
    expect(mobilePrimaryNavigationViews).toEqual(['dashboard', 'clients', 'jobs', 'invoices'])
    expect(mobileSecondaryNavigationViews).toEqual([
      'alerts',
      'leads',
      'properties',
      'quotes',
      'payments',
      'expenses',
      'fiscal_closing',
    ])
    expect(new Set([...mobilePrimaryNavigationViews, ...mobileSecondaryNavigationViews]).size).toBe(11)
  })

  it('maps closing child views to the single fiscal closing active state', () => {
    expect(isAppNavigationItemActive('fiscal_closing', 'quarterly_closing')).toBe(true)
    expect(isAppNavigationItemActive('fiscal_closing', 'annual_closing')).toBe(true)
    expect(isAppNavigationItemActive('fiscal_closing', 'invoices')).toBe(false)
  })
})
