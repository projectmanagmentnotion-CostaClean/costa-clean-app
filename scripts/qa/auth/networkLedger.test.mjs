import { describe, expect, it } from 'vitest'
import {
  classifyRequest,
  classifyBusinessWrite,
  createNetworkLedger,
  getExactViewportMetrics,
  recordRequest,
  summarizeNetworkLedger,
} from './networkLedger.mjs'

describe('deterministic QA network ledger', () => {
  it('classifies QA, production and unknown Supabase hosts without query data', () => {
    expect(classifyRequest({ method: 'GET', url: 'https://kpvvydthlxupjjqqdpxy.supabase.co/rest/v1/clients?select=*' })).toMatchObject({ environment: 'QA_SUPABASE', pathname: '/rest/v1/clients', mutation: 'READ' })
    expect(classifyRequest({ method: 'GET', url: 'https://wfxnwfcdjainpojhbdri.supabase.co/rest/v1/clients?select=*' }).environment).toBe('PRODUCTION_SUPABASE')
    expect(classifyRequest({ method: 'GET', url: 'https://other.supabase.co/rest/v1/clients' }).environment).toBe('UNKNOWN_SUPABASE')
    expect(classifyRequest({ method: 'GET', url: 'https://kpvvydthlxupjjqqdpxy.supabase.co/rest/v1/clients?token=secret' }).pathname).toBe('/rest/v1/clients')
  })

  it('separates auth/session POSTs from potentially mutating business requests', () => {
    expect(classifyRequest({ method: 'POST', url: 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1/token' }).mutation).toBe('AUTH_SESSION')
    expect(classifyRequest({ method: 'POST', url: 'https://kpvvydthlxupjjqqdpxy.supabase.co/rest/v1/clients' }).mutation).toBe('UNKNOWN_MUTATION')
    expect(classifyBusinessWrite(classifyRequest({ method: 'POST', url: 'https://kpvvydthlxupjjqqdpxy.supabase.co/rest/v1/clients' }))).toBe('BUSINESS_WRITE')
  })

  it('summarizes actual recorded request metadata', () => {
    const ledger = createNetworkLedger()
    recordRequest(ledger, { method: () => 'GET', url: () => 'http://127.0.0.1:4178/assets/app.js', resourceType: () => 'script' })
    recordRequest(ledger, { method: () => 'POST', url: () => 'https://kpvvydthlxupjjqqdpxy.supabase.co/auth/v1/token', resourceType: () => 'fetch' })
    expect(summarizeNetworkLedger(ledger)).toMatchObject({ totalRequests: 2, qaSupabaseRequests: 1, unknownMutations: 0 })
    expect(ledger.entries[1]).not.toHaveProperty('url', expect.stringContaining('?'))
  })

  it('exposes a page metric contract for exact viewport assertions', () => {
    expect(typeof getExactViewportMetrics).toBe('function')
  })
})
