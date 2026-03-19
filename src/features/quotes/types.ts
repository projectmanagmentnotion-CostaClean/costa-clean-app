export interface QuoteListItem {
  id: string
  display_code: string | null
  client_id: string
  client_display_code?: string | null
  property_id: string | null
  property_display_code?: string | null
  status: string
  subtotal: number
  tax_amount: number | null
  total: number
  notes?: string | null
}
