export interface PropertyListItem {
  id: string
  display_code: string | null
  client_id: string
  client_display_code?: string | null
  name: string
  property_type: string
  address: string
  city: string | null
  postal_code: string | null
  notes?: string | null
}
