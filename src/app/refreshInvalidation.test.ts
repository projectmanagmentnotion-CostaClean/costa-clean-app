import { describe, expect, it } from 'vitest'
import { getRefreshScopeForTable, realtimeTables } from './refreshInvalidation'

describe('N1 Realtime invalidation coverage', () => {
  it('subscribes once to every internal domain and routes events to canonical refresh scopes', () => {
    expect(new Set(realtimeTables).size).toBe(realtimeTables.length)
    for (const table of ['clients', 'properties', 'leads', 'quotes', 'jobs', 'invoices', 'payments', 'expenses', 'recurring_invoice_plans']) {
      expect(realtimeTables.filter((candidate) => candidate === table)).toHaveLength(1)
    }
    expect(getRefreshScopeForTable('quarterly_closings')).toBe('closings')
    expect(getRefreshScopeForTable('clients')).toBe('operations')
    expect(getRefreshScopeForTable('invoices')).toBe('billing')
    expect(getRefreshScopeForTable('expenses')).toBe('all')
  })
})
