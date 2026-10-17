import { getSupabaseClient } from '../../lib/supabase'
import type { Material, MaterialMovement, MaterialMovementType, MaterialUnit } from './materialOperational'

function clientOrThrow() { const { client, error } = getSupabaseClient(); if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.'); return client }
export async function listMaterials() { const { data, error } = await clientOrThrow().rpc('list_materials'); if (error) throw error; return (data ?? []) as Material[] }
export async function saveMaterial(material: Partial<Material> & Pick<Material, 'id' | 'name' | 'unit'>) { const { data, error } = await clientOrThrow().rpc('save_material', { p_material: material }); if (error) throw error; return data as Material }
export async function recordMaterialMovement(movement: { id?: string; material_id: string; movement_type: MaterialMovementType; quantity: number; unit_cost_snapshot?: number | null; occurred_at?: string; job_id?: string | null; client_id?: string | null; property_id?: string | null; expense_id?: string | null; notes?: string | null; idempotency_key: string }) { const { data, error } = await clientOrThrow().rpc('record_material_movement', { p_movement: movement }); if (error) throw error; return data as MaterialMovement & { current_stock: number } }
export async function listJobMaterialMovements(jobId: string) { const { data, error } = await clientOrThrow().from('material_movements').select('*').eq('job_id', jobId).order('occurred_at'); if (error) throw error; return (data ?? []) as MaterialMovement[] }
export type { Material, MaterialMovement, MaterialMovementType, MaterialUnit }
