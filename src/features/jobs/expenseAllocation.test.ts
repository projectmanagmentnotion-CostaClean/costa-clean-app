import { describe, expect, it } from 'vitest'
import { isExpenseOperationallyAllocatable, remainingAllocatableBase, totalOtherDirectCost } from './expenseAllocation'

describe('N8 direct expense allocation', () => {
  it('allows direct categories and excludes general overhead/material purchases', () => {
    expect(isExpenseOperationallyAllocatable('combustible')).toBe(true)
    expect(isExpenseOperationallyAllocatable('transporte')).toBe(true)
    expect(isExpenseOperationallyAllocatable('servicios_profesionales')).toBe(true)
    expect(isExpenseOperationallyAllocatable('alquiler')).toBe(false)
    expect(isExpenseOperationallyAllocatable('software')).toBe(false)
    expect(isExpenseOperationallyAllocatable('materiales')).toBe(false)
    expect(isExpenseOperationallyAllocatable('productos_limpieza')).toBe(false)
  })
  it('protects the source base and excludes invalid source allocations', () => {
    expect(remainingAllocatableBase(100, 60)).toBe(40)
    expect(totalOtherDirectCost([{ id: 'a', expense_id: 'e', job_id: 'j', allocated_base_amount: 20, expense_subtotal_snapshot: 100, expense_category_snapshot: 'combustible', allocation_status: 'active' }, { id: 'b', expense_id: 'e', job_id: 'j2', allocated_base_amount: 30, expense_subtotal_snapshot: 100, expense_category_snapshot: 'combustible', allocation_status: 'invalid_source' }])).toBe(20)
  })
})
