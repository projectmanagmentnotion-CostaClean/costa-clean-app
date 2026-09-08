import { describe, expect, it } from 'vitest'
import { readLeadDeepLink } from './leadDeepLink'

describe('lead deep links', () => {
  it('reads a lead workspace id', () => {
    expect(readLeadDeepLink('?v3=1&view=leads&lead=LEAD-42')).toBe('LEAD-42')
  })

  it('ignores an empty lead id', () => {
    expect(readLeadDeepLink('?view=leads&lead=')).toBeNull()
  })
})
