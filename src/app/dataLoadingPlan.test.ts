import { describe, expect, it } from 'vitest'
import { getDomainsForScope } from './dataLoadingPlan'

describe('quote refresh contract', () => {
  it('refreshes quotes through the billing scope, not operations', () => {
    expect(getDomainsForScope('billing')).toContain('quotes')
    expect(getDomainsForScope('operations')).not.toContain('quotes')
  })
})
