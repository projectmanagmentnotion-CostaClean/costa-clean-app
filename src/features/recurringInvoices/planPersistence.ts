import type { RecurringInvoicePlanListItem } from './types'

export function buildRecurringPlanPersistenceInput(
  plan: RecurringInvoicePlanListItem,
  overrides: Partial<RecurringInvoicePlanListItem> = {},
) {
  return {
    id: overrides.id ?? plan.id,
    client_id: overrides.client_id ?? plan.client_id,
    property_id: overrides.property_id ?? plan.property_id,
    quote_id: overrides.quote_id ?? plan.quote_id,
    title: overrides.title ?? plan.title,
    frequency: overrides.frequency ?? plan.frequency,
    status: overrides.status ?? plan.status,
    default_invoice_status: overrides.default_invoice_status ?? plan.default_invoice_status,
    next_issue_date: overrides.next_issue_date ?? plan.next_issue_date,
    last_issued_at: overrides.last_issued_at ?? plan.last_issued_at,
    tax_rate: overrides.tax_rate ?? plan.tax_rate,
    notes: overrides.notes ?? plan.notes,
    internal_notes: overrides.internal_notes ?? plan.internal_notes,
    pricing_metadata: overrides.pricing_metadata ?? plan.pricing_metadata,
    template_lines: overrides.template_lines ?? plan.template_lines,
  }
}
