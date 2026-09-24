import { describe, expect, it } from 'vitest'
import { comparePlannedMaterial, plannedContribution, plannedDirectCost, plannedLaborCost, plannedMarginPercent, plannedMaterialCost } from './recurringOperational'

const team = [{ team_member_id: 'worker', planned_minutes: 180, default_hourly_cost: 10 }]
const materials = [{ material_id: 'bleach', planned_quantity: 3, default_unit_cost: 2 }]

describe('recurring operational planning', () => {
  it('calculates planned labor, material and direct cost without actual side effects', () => {
    expect(plannedLaborCost(team)).toBe(30)
    expect(plannedMaterialCost(materials)).toBe(6)
    expect(plannedDirectCost(team, materials)).toBe(36)
    expect(plannedContribution(100, team, materials)).toBe(64)
    expect(plannedMarginPercent(100, 64)).toBe(64)
    expect(plannedMarginPercent(0, 0)).toBeNull()
  })

  it('supports overrides and planned-vs-actual material comparison', () => {
    expect(plannedLaborCost([{ ...team[0], hourly_cost_override: 12 }])).toBe(36)
    expect(comparePlannedMaterial(3, 2, 4, 2.5)).toEqual({ plannedQuantity: 3, actualQuantity: 4, quantityVariance: 1, plannedCost: 6, actualCost: 10, costVariance: 4 })
    expect(comparePlannedMaterial(3, 2, 4, 2.5, false).quantityVariance).toBeNull()
  })
})
