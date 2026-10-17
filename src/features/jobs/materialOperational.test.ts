import { describe, expect, it } from 'vitest'
import { derivedStock, directMaterialCost, movementSign, totalDirectMaterialCost } from './materialOperational'

describe('N7 material ledger helpers', () => {
  it('derives signed stock without persisting a stock field', () => {
    expect(movementSign('stock_in')).toBe(1)
    expect(movementSign('return_in')).toBe(1)
    expect(movementSign('consumption')).toBe(-1)
    expect(derivedStock([{ movement_type: 'stock_in', quantity: 10 }, { movement_type: 'consumption', quantity: 3 }, { movement_type: 'adjustment_out', quantity: 1 }])).toBe(6)
  })

  it('counts only consumption at the historical unit-cost snapshot', () => {
    expect(directMaterialCost({ movement_type: 'consumption', quantity: 2.5, unit_cost_snapshot: 4 })).toBe(10)
    expect(directMaterialCost({ movement_type: 'return_in', quantity: 2.5, unit_cost_snapshot: 4 })).toBe(0)
    expect(totalDirectMaterialCost([{ id: 'a', material_id: 'm', movement_type: 'consumption', quantity: 2, unit_cost_snapshot: 4, occurred_at: '2026-09-23' }, { id: 'b', material_id: 'm', movement_type: 'consumption', quantity: 1, unit_cost_snapshot: 3, occurred_at: '2026-09-23' }])).toBe(11)
  })
})
