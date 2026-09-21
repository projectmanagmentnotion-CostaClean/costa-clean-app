import { describe, expect, it } from 'vitest'
import { normalizeExpenseUpdatePayload } from './expenseApi'

describe('expense update patch semantics', () => {
  it('does not add defaults for fields omitted by a partial edit', () => {
    expect(normalizeExpenseUpdatePayload({
      expense_date: '2026-09-10',
      supplier_name: 'Proveedor',
      category: 'materiales',
      description: 'Nota editada',
      subtotal: 100,
      notes: 'Solo cambia esto',
    })).toEqual({
      expense_date: '2026-09-10',
      supplier_name: 'Proveedor',
      category: 'materiales',
      description: 'Nota editada',
      subtotal: 100,
      notes: 'Solo cambia esto',
    })
  })

  it('preserves explicitly supplied attachment and closure values', () => {
    expect(normalizeExpenseUpdatePayload({
      expense_date: '2026-09-10',
      supplier_name: 'Proveedor',
      category: 'materiales',
      description: 'Gasto',
      subtotal: 100,
      receipt_file_path: 'expenses/evidence.pdf',
      receipt_file_url: 'storage://expense-receipts/expenses/evidence.pdf',
      attachment_count: 1,
      affects_quarterly_closure: false,
      affects_annual_closure: false,
    })).toMatchObject({
      receipt_file_path: 'expenses/evidence.pdf',
      receipt_file_url: 'storage://expense-receipts/expenses/evidence.pdf',
      attachment_count: 1,
      affects_quarterly_closure: false,
      affects_annual_closure: false,
    })
  })
})
