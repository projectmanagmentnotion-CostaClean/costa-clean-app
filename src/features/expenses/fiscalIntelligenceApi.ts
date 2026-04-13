import { updateExpenseFiscalIntelligence } from './expenseApi'
import {
  buildExpenseFiscalPrecheck,
  expenseFiscalIntelligenceSourceVersion,
} from './fiscalIntelligenceRules'
import type {
  ExpenseFiscalIntelligenceResponse,
  ExpenseFiscalIntelligenceResult,
  ExpenseListItem,
} from './types'

function buildExpensePayload(expense: ExpenseListItem) {
  return {
    id: expense.id,
    display_code: expense.display_code,
    expense_date: expense.expense_date,
    supplier_name: expense.supplier_name,
    supplier_tax_id: expense.supplier_tax_id,
    category: expense.category,
    subcategory: expense.subcategory,
    description: expense.description,
    document_type: expense.document_type,
    document_support_status: expense.document_support_status,
    has_receipt_file: Boolean(expense.receipt_file_path),
    receipt_file_path: expense.receipt_file_path,
    payment_method: expense.payment_method,
    payment_status: expense.payment_status,
    subtotal: Number(expense.subtotal || 0),
    tax_rate: Number(expense.tax_rate || 0),
    tax_amount: Number(expense.tax_amount || 0),
    total: Number(expense.total || 0),
    is_deductible: Boolean(expense.is_deductible),
    deductible_percentage: Number(expense.deductible_percentage || 0),
    fiscal_review_status: expense.fiscal_review_status,
    fiscal_risk_level: expense.fiscal_risk_level,
    manager_note: expense.manager_note,
    notes: expense.notes,
  }
}

export async function analyzeExpenseFiscalIntelligence(
  expense: ExpenseListItem,
): Promise<ExpenseFiscalIntelligenceResponse> {
  const deterministicPrecheck = buildExpenseFiscalPrecheck(expense)
  const response = await fetch('/api/expense-fiscal-intelligence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expense: buildExpensePayload(expense),
      deterministic_precheck: deterministicPrecheck,
      source_version: expenseFiscalIntelligenceSourceVersion,
    }),
  })

  const data = (await response.json().catch(() => null)) as
    | ExpenseFiscalIntelligenceResponse
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(data && 'error' in data && data.error ? data.error : 'No se pudo generar la estimacion fiscal.')
  }

  if (!data || !('result' in data)) {
    throw new Error('La respuesta fiscal no llego con el formato esperado.')
  }

  return data
}

export async function saveExpenseFiscalIntelligenceResult(
  expenseId: string,
  response: ExpenseFiscalIntelligenceResponse,
): Promise<void> {
  const result: ExpenseFiscalIntelligenceResult = response.result

  await updateExpenseFiscalIntelligence(expenseId, {
    ai_fiscal_classification: result.classification,
    ai_deductibility_percentage: result.deductibility_percentage,
    ai_vat_deductibility_percentage: result.vat_deductibility_percentage,
    ai_estimated_deductible_base: result.estimated_deductible_base,
    ai_estimated_deductible_vat: result.estimated_deductible_vat,
    ai_fiscal_confidence: result.confidence,
    ai_fiscal_risk_level: result.risk_level,
    ai_fiscal_reasoning: result.reasoning,
    ai_fiscal_flags: result.flags,
    ai_fiscal_model: response.model,
    ai_fiscal_analyzed_at: response.generated_at,
    ai_fiscal_source_version: response.source_version,
  })
}
