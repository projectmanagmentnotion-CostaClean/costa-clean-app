import { getSupabaseClient } from '../../lib/supabase'
import type { ExpenseListItem, ExpenseUpsertInput } from './types'

const EXPENSES_SELECT = [
  'id',
  'display_code',
  'expense_number',
  'expense_date',
  'accounting_date',
  'due_date',
  'supplier_name',
  'supplier_tax_id',
  'category',
  'subcategory',
  'description',
  'document_type',
  'reference_number',
  'payment_method',
  'payment_status',
  'currency',
  'subtotal',
  'tax_rate',
  'tax_amount',
  'total',
  'is_deductible',
  'deductible_percentage',
  'affects_quarterly_closure',
  'affects_annual_closure',
  'receipt_file_url',
  'receipt_file_path',
  'attachment_count',
  'notes',
  'fiscal_year',
  'fiscal_quarter',
  'created_at',
  'updated_at',
].join(',')

function normalizeExpensePayload(input: ExpenseUpsertInput) {
  return {
    expense_date: input.expense_date,
    accounting_date: input.accounting_date ?? null,
    due_date: input.due_date ?? null,

    supplier_name: input.supplier_name.trim(),
    supplier_tax_id: input.supplier_tax_id?.trim() || null,

    category: input.category,
    subcategory: input.subcategory?.trim() || null,
    description: input.description.trim(),

    document_type: input.document_type ?? 'ticket',
    reference_number: input.reference_number?.trim() || null,

    payment_method: input.payment_method ?? null,
    payment_status: input.payment_status ?? 'paid',

    currency: input.currency ?? 'EUR',

    subtotal: input.subtotal,
    tax_rate: input.tax_rate ?? 21,
    tax_amount: input.tax_amount ?? 0,
    total: input.total ?? 0,

    is_deductible: input.is_deductible ?? true,
    deductible_percentage: input.deductible_percentage ?? 100,

    affects_quarterly_closure: input.affects_quarterly_closure ?? true,
    affects_annual_closure: input.affects_annual_closure ?? true,

    receipt_file_url: input.receipt_file_url ?? null,
    receipt_file_path: input.receipt_file_path ?? null,
    attachment_count: input.attachment_count ?? 0,

    notes: input.notes?.trim() || null,
  }
}

export async function listExpenses(): Promise<ExpenseListItem[]> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { data, error: queryError } = await client
    .from('expenses')
    .select(EXPENSES_SELECT)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as unknown as ExpenseListItem[]
}

export async function createExpense(input: ExpenseUpsertInput): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const payload = normalizeExpensePayload(input)

  const { error: insertError } = await client
    .from('expenses')
    .insert(payload)

  if (insertError) {
    throw new Error(insertError.message)
  }
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseUpsertInput,
): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const payload = normalizeExpensePayload(input)

  const { error: updateError } = await client
    .from('expenses')
    .update(payload)
    .eq('id', expenseId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export async function updateExpenseAttachment(
  expenseId: string,
  filePath: string | null,
): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const fileUrl = filePath ? `storage://expense-receipts/${filePath}` : null
  const attachmentCount = filePath ? 1 : 0

  const { error: updateError } = await client
    .from('expenses')
    .update({
      receipt_file_path: filePath,
      receipt_file_url: fileUrl,
      attachment_count: attachmentCount,
    })
    .eq('id', expenseId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export { EXPENSES_SELECT }
