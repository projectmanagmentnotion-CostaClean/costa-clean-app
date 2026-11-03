import { describe, expect, it } from 'vitest'
import { clearModuleEntityDeepLink } from './useShellNavigation'

describe('module detail URL reset', () => {
  it.each([
    ['invoices', 'invoice', 'inv-1'],
    ['quotes', 'quote', 'q-1'],
    ['payments', 'payment', 'pay-1'],
    ['jobs', 'job', 'job-1'],
    ['properties', 'property', 'prop-1'],
    ['clients', 'client', 'client-1'],
    ['leads', 'lead', 'lead-1'],
    ['expenses', 'expense', 'exp-1'],
  ] as const)('clears %s detail selection without dropping unrelated query state', (view, key, id) => {
    const url = clearModuleEntityDeepLink(view, `https://app.example/?view=${view}&${key}=${id}&search=ana&status=active`)
    const parsed = new URL(url)
    expect(parsed.searchParams.has(key)).toBe(false)
    expect(parsed.searchParams.get('view')).toBe(view)
    expect(parsed.searchParams.get('search')).toBe('ana')
    expect(parsed.searchParams.get('status')).toBe('active')
  })

  it('removes transient client/property tabs on module exit', () => {
    expect(new URL(clearModuleEntityDeepLink('clients', 'https://app.example/?view=clients&client=c-1&tab=documents')).searchParams.has('tab')).toBe(false)
    expect(new URL(clearModuleEntityDeepLink('properties', 'https://app.example/?view=properties&property=p-1&tab=activity')).searchParams.has('tab')).toBe(false)
  })
})
