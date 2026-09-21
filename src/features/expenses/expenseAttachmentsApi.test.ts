import { describe, expect, it } from 'vitest'
import { EXPENSE_RECEIPT_MAX_BYTES, validateExpenseReceipt } from './expenseAttachmentsApi'

describe('expense receipt validation', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(validateExpenseReceipt({ type, size: 1024 })).toBeNull()
  })

  it('rejects unsupported MIME types', () => {
    expect(validateExpenseReceipt({ type: 'text/plain', size: 1024 })).toContain('PDF')
  })

  it('rejects files larger than 10 MB', () => {
    expect(validateExpenseReceipt({ type: 'application/pdf', size: EXPENSE_RECEIPT_MAX_BYTES + 1 })).toContain('10 MB')
  })
})
