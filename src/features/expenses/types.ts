export type ExpenseCategory =
  | 'products'
  | 'transport'
  | 'fuel'
  | 'materials'
  | 'maintenance'
  | 'software'
  | 'supplies'
  | 'rent'
  | 'utilities'
  | 'marketing'
  | 'professional_services'
  | 'other'

export type ExpenseReceiptStatus =
  | 'pending'
  | 'uploaded'
  | 'validated'

export interface ExpenseListItem {
  id: string
  display_code: string | null
  expense_date: string
  category: ExpenseCategory | string | null
  supplier: string | null
  concept: string
  amount: number
  tax_amount: number | null
  total: number | null
  is_deductible: boolean | null
  receipt_status: ExpenseReceiptStatus | string | null
  notes?: string | null
}