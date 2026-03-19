export interface PaymentListItem {
  id: string
  display_code: string | null
  invoice_id: string
  invoice_display_code?: string | null
  invoice_number?: string | null
  payment_date: string
  amount: number
  payment_method: string | null
  notes?: string | null
}
