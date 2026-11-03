import { describe, expect, it } from 'vitest'
import { decimalAbsDifference, decimalAdd, decimalCompare, decimalSubtract, normalizeDecimal } from './expenseNormalizationDecimals'
describe('N5.3 exact decimals', () => {
  it('normalizes supported locale forms and rejects ambiguity', () => { expect(normalizeDecimal('1.234,56').value).toBe('1234.56'); expect(normalizeDecimal('1,234.56').value).toBe('1234.56'); expect(normalizeDecimal('-123,45').value).toBe('-123.45'); expect(normalizeDecimal('1,234').status).toBe('AMBIGUOUS') })
  it('uses exact BigInt arithmetic', () => { expect(decimalAdd('999999999999999999.99', '0.01')).toBe('1000000000000000000.00'); expect(decimalSubtract('10.00', '0.01')).toBe('9.99'); expect(decimalCompare('1.00', '1')).toBe(0); expect(decimalAbsDifference('-1.00', '1.00')).toBe('2.00') })
})
