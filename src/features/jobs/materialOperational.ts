export const materialUnits = ['unit', 'bottle', 'liter', 'milliliter', 'kilogram', 'gram', 'box', 'pack', 'roll'] as const
export type MaterialUnit = (typeof materialUnits)[number]
export type MaterialMovementType = 'stock_in' | 'consumption' | 'adjustment_in' | 'adjustment_out' | 'return_in'

export interface Material { id: string; display_code?: string | null; name: string; category?: string | null; unit: MaterialUnit; status: 'active' | 'inactive'; default_unit_cost: number | null; minimum_stock: number | null; notes?: string | null; archived_at?: string | null; current_stock?: number }
export interface MaterialMovement { id: string; material_id: string; movement_type: MaterialMovementType; quantity: number; unit_cost_snapshot: number | null; occurred_at: string; job_id?: string | null; client_id?: string | null; property_id?: string | null; expense_id?: string | null; notes?: string | null; idempotency_key?: string | null }

export function movementSign(type: MaterialMovementType) { return type === 'consumption' || type === 'adjustment_out' ? -1 : 1 }
export function derivedStock(movements: Pick<MaterialMovement, 'movement_type' | 'quantity'>[]) { return movements.reduce((stock, movement) => stock + movementSign(movement.movement_type) * movement.quantity, 0) }
export function directMaterialCost(movement: Pick<MaterialMovement, 'movement_type' | 'quantity' | 'unit_cost_snapshot'>) { return movement.movement_type === 'consumption' ? Math.round((movement.quantity * Number(movement.unit_cost_snapshot ?? 0) + Number.EPSILON) * 100) / 100 : 0 }
export function totalDirectMaterialCost(movements: MaterialMovement[]) { return Math.round((movements.reduce((sum, movement) => sum + directMaterialCost(movement), 0) + Number.EPSILON) * 100) / 100 }
export const materialUnitLabels: Record<MaterialUnit, string> = { unit: 'Unidad', bottle: 'Botella', liter: 'Litro', milliliter: 'Mililitro', kilogram: 'Kilogramo', gram: 'Gramo', box: 'Caja', pack: 'Paquete', roll: 'Rollo' }
