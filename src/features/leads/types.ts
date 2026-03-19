export interface LeadListItem {
  id: string
  display_code: string | null
  full_name: string
  phone: string
  email: string | null
  city: string | null
  status: string
  archived_at?: string | null
}
