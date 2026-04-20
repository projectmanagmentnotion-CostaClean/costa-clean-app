export interface QuoteListItem {
  id: string
  display_code: string | null
  lead_id?: string | null
  lead_display_code?: string | null
  lead_name?: string | null
  client_id: string | null
  client_display_code?: string | null
  property_id: string | null
  property_display_code?: string | null
  status: string
  job_id?: string | null
  subtotal: number
  tax_amount: number | null
  total: number
  notes?: string | null
  created_at?: string
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
