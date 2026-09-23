import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923190000_n7_material_control.sql', 'utf8')
const helpers = readFileSync('src/features/jobs/materialOperational.ts', 'utf8')
const materialsUi = readFileSync('src/features/jobs/MaterialManagement.tsx', 'utf8')
const jobUi = readFileSync('src/features/jobs/JobMaterialsPanel.tsx', 'utf8')

describe('N7 material control contract', () => {
  it('derives stock from signed movements and protects internal boundaries', () => {
    expect(migration).toContain('create table if not exists public.materials')
    expect(migration).toContain('create table if not exists public.material_movements')
    expect(migration).toContain('material_signed_effect')
    expect(migration).not.toMatch(/current_stock\s+(numeric|integer|text|boolean)|signed_quantity\s+(numeric|integer|text|boolean)/i)
    expect(migration).toContain('MATERIAL_INSUFFICIENT_STOCK')
    expect(migration).toContain('idempotency_key text unique')
    expect(migration).toContain('portal_private.require_active_internal_staff()')
    expect(migration).toContain('revoke all on table public.materials, public.material_movements from public, anon, authenticated')
  })

  it('validates job context and snapshots material cost without mutating expenses', () => {
    expect(migration).toContain('material_client_job_mismatch')
    expect(migration).toContain('material_property_job_mismatch')
    expect(migration).toContain('coalesce(nullif(p_movement ->> \'unit_cost_snapshot\', \'\')::numeric, v_material.default_unit_cost)')
    expect(migration).toContain('material_expense_link_invalid')
    expect(migration).not.toMatch(/update public\.expenses|delete from public\.expenses|insert into public\.expenses/i)
    expect(helpers).toContain("movement_type === 'consumption'")
    expect(helpers).toContain('derivedStock')
  })

  it('exposes material management, job consumption, and profitability refresh', () => {
    expect(materialsUi).toContain('Nuevo material')
    expect(materialsUi).toContain('Registrar entrada')
    expect(materialsUi).toContain('Stock bajo')
    expect(materialsUi).toContain('Sin stock')
    expect(jobUi).toContain('Registrar consumo')
    expect(jobUi).toContain('datetime-local')
    expect(jobUi).toContain('idempotency_key')
  })
})
