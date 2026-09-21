import { describe, expect, it } from 'vitest'
import { readQuoteDeepLink } from './quoteDeepLink'

describe('quote deep link', () => {
  it('reads only a non-empty quote id', () => {
    expect(readQuoteDeepLink('?v3=1&view=quotes&quote=quote-1')).toBe('quote-1')
    expect(readQuoteDeepLink('?v3=1&view=quotes&quote=')).toBeNull()
  })
})
