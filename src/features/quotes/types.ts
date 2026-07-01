export interface QuoteListItem {
  id: string
  display_code: string | null
  lead_id?: string | null
  lead_display_code?: string | null
  lead_name?: string | null
  client_id: string | null
  client_display_code?: string | null
  client_name?: string | null
  property_id: string | null
  property_display_code?: string | null
  status: string
  archived_at?: string | null
  deleted_at?: string | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  job_id?: string | null
  invoice_id?: string | null
  subtotal: number
  tax_amount: number | null
  total: number
  notes?: string | null
  internal_notes?: string | null
  pricing_metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
  quote_lines?: QuoteLineItem[]
  lines?: QuoteLineItem[]
}

export interface QuoteLineItem {
  id: string
  quote_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string | null
  unit_price: number
  line_subtotal: number
  created_at?: string
}
