import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql', import.meta.url)
const sql = await fs.readFile(migrationPath, 'utf8')

describe('RLS operational write migration', () => {
  it('creates only authenticated operational RPC entry points', () => {
    for (const signature of [
      'create_client(p_client jsonb)',
      'update_client(p_client jsonb)',
      'create_property(p_property jsonb)',
      'update_property(p_property jsonb)',
      'update_job_status(p_job_id text, p_status text)',
      'reassign_property_client_authenticated(p_property_id text, p_client_id text)',
    ]) {
      expect(sql.includes(`function public.${signature}`)).toBe(true)
    }
    expect(sql.includes('perform public.require_authenticated_write();')).toBe(true)
  })

  it('removes legacy anon writes and revokes public/anon RPC execution', () => {
    expect(sql.includes('drop policy if exists "Allow public insert access on clients"')).toBe(true)
    expect(sql.includes('drop policy if exists "Allow public update access on properties"')).toBe(true)
    expect(sql.includes('drop policy if exists "Allow public update access on jobs"')).toBe(true)
    expect(sql.includes('from public, anon')).toBe(true)
  })

  it('does not touch protected financial tables, numbering or service-role credentials', () => {
    for (const forbidden of [
      'public.invoices',
      'public.payments',
      'public.quarterly_closings',
      'public.annual_closings',
      'invoice_number',
      'display_code',
      'service_role',
    ]) {
      expect(sql.includes(forbidden)).toBe(false)
    }
  })
})
