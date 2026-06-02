export interface ClientListItem {
  id: string
  display_code: string | null
  created_at?: string
  full_name: string
  phone: string | null
  email: string | null
  tax_id: string | null
  billing_address: string | null
  status: string
  source_lead_id: string | null
  source_lead_display_code?: string | null
  source_lead_name?: string | null
}
