import { describe, expect, it } from 'vitest'
import { readPaymentDeepLink } from './paymentDeepLink'

describe('payment deep link', () => {
  it('reads the exact payment id', () => expect(readPaymentDeepLink('?v3=1&view=payments&payment=pay-42')).toBe('pay-42'))
  it('ignores an empty payment id', () => expect(readPaymentDeepLink('?payment=')).toBeNull())
})
