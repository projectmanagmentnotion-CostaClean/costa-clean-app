export interface InvoiceListItem {
  id: string
  display_code: string | null
  invoice_number: string | null
  job_id: string
  job_display_code?: string | null
  client_id: string
  client_display_code?: string | null
  issue_date: string
  status: string
  subtotal: number
  tax_amount: number
  total: number
  notes?: string | null

  client_name?: string | null
  client_phone?: string | null
  client_email?: string | null

  property_id?: string | null
  property_display_code?: string | null
  property_name?: string | null
  property_address_line?: string | null

  quote_id?: string | null
  service_reference?: string | null
  service_description?: string | null
  billing_concept?: string | null
  billing_quantity?: number | null
  billing_unit?: string | null
  billing_unit_price?: number | null
}
