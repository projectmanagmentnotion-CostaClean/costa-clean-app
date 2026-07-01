export interface PropertyListItem {
  id: string
  display_code: string | null
  client_id: string
  client_display_code?: string | null
  client_name?: string | null
  name: string
  status?: string | null
  archived_at?: string | null
  deleted_at?: string | null
  property_type: string
  address: string
  city: string | null
  postal_code: string | null
  notes?: string | null
}
