export interface PaymentListItem {
  id: string
  display_code: string | null
  invoice_id: string
  invoice_display_code?: string | null
  invoice_number?: string | null
  payment_date: string
  created_at?: string | null
  amount: number
  payment_method: string | null
  origin_type?: string | null
  notes?: string | null
}
