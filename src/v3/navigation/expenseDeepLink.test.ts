import { describe, expect, it } from 'vitest'
import { readExpenseDeepLink } from './expenseDeepLink'

describe('expense deep link', () => {
  it('reads the exact expense id', () => expect(readExpenseDeepLink('?v3=1&view=expenses&expense=exp-42')).toBe('exp-42'))
  it('ignores an empty expense id', () => expect(readExpenseDeepLink('?expense=')).toBeNull())
})
