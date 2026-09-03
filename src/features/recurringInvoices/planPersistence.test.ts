import { describe, expect, it } from 'vitest'
import { buildRecurringPlanPersistenceInput } from './planPersistence'
import type { RecurringInvoicePlanListItem } from './types'

const plan: RecurringInvoicePlanListItem = {
  id: 'RECURRING-1',
  client_id: 'CLIENT-1',
  property_id: null,
  quote_id: null,
  title: 'Mantenimiento mensual',
  frequency: 'monthly',
  status: 'active',
  default_invoice_status: 'draft',
  next_issue_date: '2026-09-10',
  last_issued_at: null,
  tax_rate: 0.21,
  notes: null,
  internal_notes: null,
  pricing_metadata: { source: 'test' },
  template_lines: [{
    concept: 'Limpieza',
    quantity: 1,
    unit: 'servicio',
    unit_price: 100,
    line_subtotal: 100,
  }],
}

describe('recurring plan persistence contract', () => {
  it('keeps the persisted contract independent of display-only relationship fields', () => {
    expect(buildRecurringPlanPersistenceInput(plan)).toEqual({
      id: 'RECURRING-1',
      client_id: 'CLIENT-1',
      property_id: null,
      quote_id: null,
      title: 'Mantenimiento mensual',
      frequency: 'monthly',
      status: 'active',
      default_invoice_status: 'draft',
      next_issue_date: '2026-09-10',
      last_issued_at: null,
      tax_rate: 0.21,
      notes: null,
      internal_notes: null,
      pricing_metadata: { source: 'test' },
      template_lines: plan.template_lines,
    })
  })

  it('supports pause and resume without changing the plan identity or template', () => {
    const paused = buildRecurringPlanPersistenceInput(plan, { status: 'paused' })
    const resumed = buildRecurringPlanPersistenceInput(plan, { status: 'active' })

    expect(paused.status).toBe('paused')
    expect(resumed.status).toBe('active')
    expect(paused.id).toBe(plan.id)
    expect(paused.template_lines).toEqual(plan.template_lines)
    expect(resumed.next_issue_date).toBe(plan.next_issue_date)
  })

  it('models optional property and quote context without inventing job or interval fields', () => {
    const persisted = buildRecurringPlanPersistenceInput(plan, {
      property_id: 'PROPERTY-1',
      quote_id: 'QUOTE-1',
    })

    expect(persisted.property_id).toBe('PROPERTY-1')
    expect(persisted.quote_id).toBe('QUOTE-1')
    expect('job_id' in persisted).toBe(false)
    expect('interval' in persisted).toBe(false)
    expect('next_run' in persisted).toBe(false)
  })
})
