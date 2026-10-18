import { describe, expect, it } from 'vitest'
import { filterDomainsByLoadedState, filterDomainsByStaleness, getDomainsForScope } from './dataLoadingPlan'

describe('filterDomainsByLoadedState', () => {
  it('preserves the view order while selecting only domains already loaded', () => {
    expect(filterDomainsByLoadedState(
      ['clients', 'properties', 'quotes', 'invoices'],
      new Set(['quotes', 'clients']),
    )).toEqual(['clients', 'quotes'])
  })

  it('returns no domains when none are loaded', () => {
    expect(filterDomainsByLoadedState(['clients', 'invoices'], new Set())).toEqual([])
  })
})

describe('quote refresh contract', () => {
  it('refreshes quotes through the billing scope, not operations', () => {
    expect(getDomainsForScope('billing')).toContain('quotes')
    expect(getDomainsForScope('operations')).not.toContain('quotes')
  })
})

describe('filterDomainsByStaleness', () => {
  it('refreshes missing or stale domains while leaving recently refreshed domains alone', () => {
    expect(filterDomainsByStaleness(
      ['clients', 'properties', 'quotes'],
      new Map([['clients', 90_000], ['properties', 20_000]]),
      new Set(),
      100_000,
      30_000,
    )).toEqual(['properties', 'quotes'])
  })

  it('does not select domains refreshed within the stale interval', () => {
    expect(filterDomainsByStaleness(
      ['clients', 'properties'],
      new Map([['clients', 90_000], ['properties', 95_000]]),
      new Set(),
      100_000,
      30_000,
    )).toEqual([])
  })

  it('keeps stale domains eligible after a failed request leaves the in-flight set', () => {
    expect(filterDomainsByStaleness(
      ['clients'],
      new Map([['clients', 10_000]]),
      new Set(),
      100_000,
      30_000,
    )).toEqual(['clients'])
  })

  it('avoids overlapping refreshes for a domain already in flight', () => {
    expect(filterDomainsByStaleness(
      ['clients'],
      new Map(),
      new Set(['clients']),
      100_000,
      30_000,
    )).toEqual([])
  })
})
