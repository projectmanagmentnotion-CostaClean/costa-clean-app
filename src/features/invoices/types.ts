export interface InvoiceListItem {
  id: string
  display_code: string | null
  invoice_number: string | null
  job_id: string | null
  job_display_code?: string | null
  quote_id?: string | null
  quote_display_code?: string | null
  client_id: string
  client_display_code?: string | null
  client_label?: string | null
  issue_date: string
  status: string
  subtotal: number
  tax_amount: number
  total: number
  notes?: string | null
  internal_notes?: string | null
  pricing_metadata?: Record<string, unknown> | null

  client_name?: string | null
  client_phone?: string | null
  client_email?: string | null

  property_id?: string | null
  property_display_code?: string | null
  property_name?: string | null
  property_address_line?: string | null

  service_reference?: string | null
  service_description?: string | null
  billing_concept?: string | null
  billing_quantity?: number | null
  billing_unit?: string | null
  billing_unit_price?: number | null
  invoice_lines?: InvoiceLineItem[]
  lines?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
  created_at?: string
}
