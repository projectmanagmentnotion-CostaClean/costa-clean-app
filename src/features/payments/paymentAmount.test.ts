import { describe, expect, it } from 'vitest'
import { getPaymentAmountError } from './paymentAmount'

describe('payment amount contract', () => {
  it('allows a partial or exact payment up to the outstanding balance', () => {
    expect(getPaymentAmountError(40, 81)).toBeNull()
    expect(getPaymentAmountError(81, 81)).toBeNull()
  })

  it('rejects over-collection instead of delegating the invariant to the RPC', () => {
    expect(getPaymentAmountError(81.01, 81)).toContain('81.00')
  })

  it('rejects invalid and non-positive amounts', () => {
    expect(getPaymentAmountError(Number.NaN, 81)).toContain('numero valido')
    expect(getPaymentAmountError(0, 81)).toContain('mayor que cero')
    expect(getPaymentAmountError(10, 0)).toContain('saldo pendiente')
  })
})
