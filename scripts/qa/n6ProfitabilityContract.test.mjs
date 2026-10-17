import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260923180000_n6_direct_operational_profitability.sql', 'utf8')
const helper = readFileSync('src/features/jobs/jobProfitability.ts', 'utf8')
const panel = readFileSync('src/features/jobs/JobProfitabilityPanel.tsx', 'utf8')
const summary = readFileSync('src/features/jobs/ServicesProfitabilitySummary.tsx', 'utf8')

describe('N6 profitability boundary', () => {
  it('uses subtotal and excludes invalid invoice states and VAT from revenue', () => {
    expect(migration).toContain('sum(subtotal)')
    expect(migration).toContain("status in ('issued', 'paid')")
    expect(migration).toContain('deleted_at is null and archived_at is null and cancelled_at is null')
    expect(helper).toContain("invoice.status === 'issued' || invoice.status === 'paid'")
    expect(helper).toContain('invoice.subtotal')
    expect(helper).not.toContain('invoice.total)')
  })

  it('reads N5 snapshots and exposes bounded internal RPCs only', () => {
    expect(migration).toContain('hourly_cost_snapshot')
    expect(migration).toContain('get_job_profitability')
    expect(migration).toContain('list_job_profitability')
    expect(migration).toContain('portal_private.require_active_internal_staff()')
    expect(migration).toContain('revoke all on function public.get_job_profitability(text) from public, anon')
    expect(migration).not.toMatch(/insert into|update public|delete from/i)
  })

  it('keeps collection separate and avoids misleading incomplete margin output', () => {
    expect(panel).toContain('Cobros (separados del margen)')
    expect(panel).toContain('Faltan horas registradas.')
    expect(panel).toContain('Servicio aún sin factura emitida.')
    expect(panel).toContain("data.direct_margin_after_materials_percent == null ? '—'")
    expect(summary).toContain('Mes actual')
    expect(summary).toContain('Mes anterior')
    expect(summary).toContain('Últimos 90 días')
  })
})
