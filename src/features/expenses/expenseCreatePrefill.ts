import type { ExpenseListItem } from './types'

export interface ExpenseCreatePrefill {
  request_id: string
  supplier_name: string
  category: string
  description: string
  document_type: string
  payment_status: string
  subtotal: string
  tax_rate: string
  tax_amount: string
  total: string
  notes: string
}

function createPrefillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `expense-prefill-${Date.now()}`
}

function formatMoneyInput(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2)
}

export function buildExpenseCreatePrefillFromExpense(expense: ExpenseListItem): ExpenseCreatePrefill {
  return {
    request_id: createPrefillId(),
    supplier_name: expense.supplier_name ?? '',
    category: expense.category ?? 'otros',
    description: expense.description ?? '',
    document_type: expense.document_type ?? 'ticket',
    payment_status: expense.payment_status ?? 'paid',
    subtotal: formatMoneyInput(expense.subtotal),
    tax_rate: formatMoneyInput(expense.tax_rate),
    tax_amount: formatMoneyInput(expense.tax_amount),
    total: formatMoneyInput(expense.total),
    notes: expense.notes ?? '',
  }
}
