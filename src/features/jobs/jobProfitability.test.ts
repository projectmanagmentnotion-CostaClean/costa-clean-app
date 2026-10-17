import { describe, expect, it } from 'vitest'
import { buildJobProfitability, plannedRevenueBase } from './jobProfitability'

const invoice = (status: string, subtotal: number, total = subtotal, extra = {}) => ({ id: status, display_code: null, invoice_number: null, job_id: 'job', client_id: 'client', issue_date: '2026-09-01', status, subtotal, tax_amount: total - subtotal, total, ...extra })
const base = { jobId: 'job', lines: [{ id: 'line', concept: 'Limpieza', quantity: 1, unit: 'servicio', unit_price: 100, line_subtotal: 100 }], invoices: [], payments: [], assignments: [], entries: [] }

describe('N6 direct operational profitability', () => {
  it('uses job lines and excludes VAT from planned revenue', () => {
    expect(plannedRevenueBase(base.lines, 1, 999)).toBe(100)
    expect(plannedRevenueBase([], 2, 50)).toBe(100)
  })

  it('calculates planned and actual labor from snapshots', () => {
    const result = buildJobProfitability({ ...base, invoices: [invoice('issued', 100, 121)], assignments: [{ id: 'a', job_id: 'job', team_member_id: 'm', planned_minutes: 60, hourly_cost_snapshot: 20, status: 'assigned' }], entries: [{ id: 't', job_id: 'job', team_member_id: 'm', work_date: '2026-09-01', minutes: 90, hourly_cost_snapshot: 20, source: 'manual' }] })
    expect(result.planned_labor_cost).toBe(20)
    expect(result.actual_labor_cost).toBe(30)
    expect(result.actual_invoiced_base).toBe(100)
    expect(result.invoice_total_with_vat).toBe(121)
    expect(result.actual_direct_contribution).toBe(70)
    expect(result.direct_margin_percent).toBe(70)
    expect(result.completeness_status).toBe('COMPLETE')
  })

  it('sums multiple invoices and workers while excluding drafts/cancelled/deleted', () => {
    const result = buildJobProfitability({ ...base, invoices: [invoice('issued', 80), invoice('paid', 20), invoice('draft', 200), invoice('cancelled', 300), invoice('issued', 500, 500, { deleted_at: '2026-09-01' })], assignments: [{ id: 'a', job_id: 'job', team_member_id: 'm1', planned_minutes: 60, hourly_cost_snapshot: 10, status: 'assigned' }, { id: 'b', job_id: 'job', team_member_id: 'm2', planned_minutes: 30, hourly_cost_snapshot: 20, status: 'completed' }], entries: [{ id: 't1', job_id: 'job', team_member_id: 'm1', work_date: '2026-09-01', minutes: 60, hourly_cost_snapshot: 10, source: 'manual' }, { id: 't2', job_id: 'job', team_member_id: 'm2', work_date: '2026-09-01', minutes: 30, hourly_cost_snapshot: 20, source: 'manual' }] })
    expect(result.actual_invoiced_base).toBe(100)
    expect(result.draft_invoice_base).toBe(200)
    expect(result.actual_labor_cost).toBe(20)
    expect(result.completeness_status).toBe('COMPLETE')
  })

  it('models incomplete and negative cases without fake percentages', () => {
    expect(buildJobProfitability({ ...base, entries: [{ id: 't', job_id: 'job', team_member_id: 'm', work_date: '2026-09-01', minutes: 60, hourly_cost_snapshot: 20, source: 'manual' }] }).completeness_status).toBe('PARTIAL_NO_INVOICE')
    expect(buildJobProfitability({ ...base, invoices: [invoice('issued', 100)], assignments: [], entries: [] }).completeness_status).toBe('PARTIAL_NO_TIME')
    expect(buildJobProfitability({ ...base, lines: [], assignments: [], entries: [] }).completeness_status).toBe('EMPTY')
    const negative = buildJobProfitability({ ...base, invoices: [invoice('issued', 10)], entries: [{ id: 't', job_id: 'job', team_member_id: 'm', work_date: '2026-09-01', minutes: 60, hourly_cost_snapshot: 20, source: 'manual' }] })
    expect(negative.actual_direct_contribution).toBe(-10)
    expect(negative.direct_margin_percent).toBe(-100)
  })
})
