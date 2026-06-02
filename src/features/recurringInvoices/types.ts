export type RecurringInvoiceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
export type RecurringInvoicePlanStatus = 'active' | 'paused' | 'archived'
export type RecurringInvoicePlanInvoiceStatus = 'draft' | 'issued'

export interface RecurringInvoicePlanLineItem {
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
}

export interface RecurringInvoicePlanListItem {
  id: string
  client_id: string
  property_id: string | null
  quote_id: string | null
  title: string
  frequency: RecurringInvoiceFrequency
  status: RecurringInvoicePlanStatus
  default_invoice_status: RecurringInvoicePlanInvoiceStatus
  next_issue_date: string
  last_issued_at: string | null
  tax_rate: number
  notes: string | null
  internal_notes: string | null
  pricing_metadata: Record<string, unknown> | null
  template_lines: RecurringInvoicePlanLineItem[]
  created_at?: string
  updated_at?: string
}
