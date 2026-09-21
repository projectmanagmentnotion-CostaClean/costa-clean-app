import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'
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
  'document_support_status',
  'fiscal_review_status',
  'fiscal_risk_level',
  'manager_note',
  'ai_fiscal_classification',
  'ai_deductibility_percentage',
  'ai_vat_deductibility_percentage',
  'ai_estimated_deductible_base',
  'ai_estimated_deductible_vat',
  'ai_fiscal_confidence',
  'ai_fiscal_risk_level',
  'ai_fiscal_reasoning',
  'ai_fiscal_flags',
  'ai_fiscal_model',
  'ai_fiscal_analyzed_at',
  'ai_fiscal_source_version',
  'notes',
  'fiscal_year',
  'fiscal_quarter',
  'created_at',
  'updated_at',
].join(',')

export function normalizeExpenseCreatePayload(input: ExpenseUpsertInput) {
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

    document_support_status: input.document_support_status ?? 'missing',
    fiscal_review_status: input.fiscal_review_status ?? 'pending',
    fiscal_risk_level: input.fiscal_risk_level ?? 'medium',
    manager_note: input.manager_note?.trim() || null,

    notes: input.notes?.trim() || null,
  }
}

export function normalizeExpenseUpdatePayload(input: ExpenseUpsertInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (input.expense_date !== undefined) payload.expense_date = input.expense_date
  if (input.accounting_date !== undefined) payload.accounting_date = input.accounting_date
  if (input.due_date !== undefined) payload.due_date = input.due_date
  if (input.supplier_name !== undefined) payload.supplier_name = input.supplier_name.trim()
  if (input.supplier_tax_id !== undefined) payload.supplier_tax_id = input.supplier_tax_id?.trim() || null
  if (input.category !== undefined) payload.category = input.category
  if (input.subcategory !== undefined) payload.subcategory = input.subcategory?.trim() || null
  if (input.description !== undefined) payload.description = input.description.trim()
  if (input.document_type !== undefined) payload.document_type = input.document_type
  if (input.reference_number !== undefined) payload.reference_number = input.reference_number?.trim() || null
  if (input.payment_method !== undefined) payload.payment_method = input.payment_method
  if (input.payment_status !== undefined) payload.payment_status = input.payment_status
  if (input.currency !== undefined) payload.currency = input.currency
  if (input.subtotal !== undefined) payload.subtotal = input.subtotal
  if (input.tax_rate !== undefined) payload.tax_rate = input.tax_rate
  if (input.tax_amount !== undefined) payload.tax_amount = input.tax_amount
  if (input.total !== undefined) payload.total = input.total
  if (input.is_deductible !== undefined) payload.is_deductible = input.is_deductible
  if (input.deductible_percentage !== undefined) payload.deductible_percentage = input.deductible_percentage
  if (input.affects_quarterly_closure !== undefined) payload.affects_quarterly_closure = input.affects_quarterly_closure
  if (input.affects_annual_closure !== undefined) payload.affects_annual_closure = input.affects_annual_closure
  if (input.receipt_file_url !== undefined) payload.receipt_file_url = input.receipt_file_url
  if (input.receipt_file_path !== undefined) payload.receipt_file_path = input.receipt_file_path
  if (input.attachment_count !== undefined) payload.attachment_count = input.attachment_count
  if (input.document_support_status !== undefined) payload.document_support_status = input.document_support_status
  if (input.fiscal_review_status !== undefined) payload.fiscal_review_status = input.fiscal_review_status
  if (input.fiscal_risk_level !== undefined) payload.fiscal_risk_level = input.fiscal_risk_level
  if (input.manager_note !== undefined) payload.manager_note = input.manager_note?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  return payload
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

export async function createExpense(input: ExpenseUpsertInput): Promise<string> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const payload = normalizeExpenseCreatePayload(input)

  const { data, error: insertError } = await client
    .from('expenses')
    .insert(payload)
    .select('id')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  await recordAuditEvent({
    entityType: 'expense',
    entityId: String(data?.id ?? ''),
    action: 'upsert',
    changedFields: Object.keys(payload),
    newValues: payload,
    metadata: { operation: 'create' },
  })

  return String(data?.id ?? '')
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseUpsertInput,
): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const payload = normalizeExpenseUpdatePayload(input)

  const { error: updateError } = await client
    .from('expenses')
    .update(payload)
    .eq('id', expenseId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  await recordAuditEvent({
    entityType: 'expense',
    entityId: expenseId,
    action: 'upsert',
    changedFields: Object.keys(payload),
    newValues: payload,
  })
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

  await recordAuditEvent({
    entityType: 'expense',
    entityId: expenseId,
    action: 'attachment_update',
    changedFields: ['receipt_file_path', 'receipt_file_url', 'attachment_count'],
    newValues: {
      receipt_file_path: filePath,
      receipt_file_url: fileUrl,
      attachment_count: attachmentCount,
    },
  })
}

export async function updateExpenseFiscalIntelligence(
  expenseId: string,
  input: {
    ai_fiscal_classification: string
    ai_deductibility_percentage: number
    ai_vat_deductibility_percentage: number
    ai_estimated_deductible_base: number
    ai_estimated_deductible_vat: number
    ai_fiscal_confidence: number
    ai_fiscal_risk_level: string
    ai_fiscal_reasoning: string
    ai_fiscal_flags: string[]
    ai_fiscal_model: string
    ai_fiscal_analyzed_at: string
    ai_fiscal_source_version: string
  },
): Promise<void> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  const { error: updateError } = await client
    .from('expenses')
    .update(input)
    .eq('id', expenseId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  await recordAuditEvent({
    entityType: 'expense',
    entityId: expenseId,
    action: 'fiscal_analysis',
    changedFields: Object.keys(input),
    newValues: input,
    metadata: {
      classification: input.ai_fiscal_classification,
      risk_level: input.ai_fiscal_risk_level,
      model: input.ai_fiscal_model,
    },
  })
}

export { EXPENSES_SELECT }
