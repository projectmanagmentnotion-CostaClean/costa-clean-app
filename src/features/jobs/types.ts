export interface JobListItem {
  id: string
  display_code: string | null
  client_id: string
  client_display_code?: string | null
  property_id: string
  property_display_code?: string | null
  quote_id: string | null
  quote_display_code?: string | null
  scheduled_date: string
  status: string
  service_type: string
  notes?: string | null
}
