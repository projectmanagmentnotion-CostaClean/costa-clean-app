import type { Material } from './materialOperational'

export interface RecurringTeamTemplate {
  id?: string
  plan_id?: string
  team_member_id: string
  planned_minutes: number
  hourly_cost_override?: number | null
  notes?: string | null
  worker_name?: string | null
  default_hourly_cost?: number | null
}

export interface RecurringMaterialTemplate {
  id?: string
  plan_id?: string
  material_id: string
  planned_quantity: number
  unit_cost_override?: number | null
  notes?: string | null
  material_name?: string | null
  unit?: Material['unit'] | string
  default_unit_cost?: number | null
}

export interface PlannedMaterialComparison {
  plannedQuantity: number
  actualQuantity: number
  quantityVariance: number | null
  plannedCost: number
  actualCost: number
  costVariance: number
}

function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }

export function plannedLaborCost(templates: RecurringTeamTemplate[]) {
  return money(templates.reduce((sum, template) => sum + template.planned_minutes / 60 * Number(template.hourly_cost_override ?? template.default_hourly_cost ?? 0), 0))
}

export function plannedMaterialCost(templates: RecurringMaterialTemplate[]) {
  return money(templates.reduce((sum, template) => sum + Number(template.planned_quantity) * Number(template.unit_cost_override ?? template.default_unit_cost ?? 0), 0))
}

export function plannedDirectCost(team: RecurringTeamTemplate[], materials: RecurringMaterialTemplate[]) {
  return money(plannedLaborCost(team) + plannedMaterialCost(materials))
}

export function plannedContribution(revenueBase: number, team: RecurringTeamTemplate[], materials: RecurringMaterialTemplate[]) {
  return money(Number(revenueBase || 0) - plannedDirectCost(team, materials))
}

export function plannedMarginPercent(revenueBase: number, contribution: number) {
  return revenueBase > 0 ? money(contribution / revenueBase * 100) : null
}

export function comparePlannedMaterial(plannedQuantity: number, plannedUnitCost: number, actualQuantity: number, actualUnitCost: number, sameUnit = true): PlannedMaterialComparison {
  return { plannedQuantity, actualQuantity, quantityVariance: sameUnit ? money(actualQuantity - plannedQuantity) : null, plannedCost: money(plannedQuantity * plannedUnitCost), actualCost: money(actualQuantity * actualUnitCost), costVariance: money(actualQuantity * actualUnitCost - plannedQuantity * plannedUnitCost) }
}
