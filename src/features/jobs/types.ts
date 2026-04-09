export interface JobListItem {
  id: string
  display_code: string | null
  client_id: string
  client_display_code?: string | null
  client_name?: string | null
  property_id: string
  property_display_code?: string | null
  property_name?: string | null
  quote_id: string | null
  quote_display_code?: string | null
  scheduled_date: string
  status: string
  invoice_id?: string | null
  service_type: string
  billing_concept?: string | null
  billing_quantity?: number | null
  billing_unit?: string | null
  billing_unit_price?: number | null
  notes?: string | null
}
