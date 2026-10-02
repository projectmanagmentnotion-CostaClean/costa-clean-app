import type { NormalizedExpenseProposal } from './expenseNormalizationContract'
import type { ExpenseCategory, ExpenseDocumentType, ExpensePaymentMethod, ExpenseUpsertInput } from './types'
import type { ExpenseDuplicateCandidate, SupplierIdentityCandidate } from './expenseSupplierIntelligence'

export type DuplicateDecision = 'CREATE_NEW' | 'USE_EXISTING' | 'CANCEL'

export interface ExpenseConfirmationInput {
  confirmed: boolean
  supplierCandidate: SupplierIdentityCandidate | null
  duplicateDecision: DuplicateDecision
  duplicateCandidate: ExpenseDuplicateCandidate | null
  category: ExpenseCategory | string
  description: string
  paymentMethod: ExpensePaymentMethod | string | null
  notes?: string | null
}

export type ExpenseConfirmationResult = {
  ok: true
  payload: ExpenseUpsertInput
  source: 'human-confirmed-normalized-proposal'
} | {
  ok: false
  errors: string[]
}

function requiredText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function decimalNumber(value: string | null | undefined): number | null {
  if (!value || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function documentType(value: string | null | undefined): ExpenseDocumentType {
  if (value === 'INVOICE') return 'factura'
  if (value === 'RECEIPT') return 'ticket'
  return 'otro'
}

export function buildConfirmedExpensePayload(proposal: NormalizedExpenseProposal, input: ExpenseConfirmationInput): ExpenseConfirmationResult {
  const errors: string[] = []
  if (!input.confirmed) errors.push('La confirmación humana es obligatoria.')
  if (proposal.reviewStatus === 'BLOCKED') errors.push('La propuesta contiene errores bloqueantes.')
  if (input.duplicateDecision === 'CANCEL') errors.push('La creación fue cancelada por el usuario.')
  if (input.duplicateDecision === 'USE_EXISTING' && !input.duplicateCandidate) errors.push('Selecciona el gasto existente que quieres reutilizar.')
  const category = requiredText(input.category)
  const description = requiredText(input.description)
  const expenseDate = proposal.invoice.issueDate.normalizedValue
  const currency = proposal.invoice.currency.normalizedValue
  const subtotal = decimalNumber(proposal.amounts.net.normalizedValue)
  const taxAmount = decimalNumber(proposal.amounts.tax.normalizedValue)
  const total = decimalNumber(proposal.amounts.gross.normalizedValue)
  if (!category) errors.push('La categoría es obligatoria.')
  if (!description) errors.push('La descripción es obligatoria.')
  if (!expenseDate) errors.push('La fecha del gasto debe estar confirmada.')
  if (!currency || currency !== 'EUR') errors.push('Solo se puede confirmar una propuesta en EUR.')
  if (subtotal === null || taxAmount === null || total === null) errors.push('Base, IVA y total deben estar disponibles para confirmar.')
  if (errors.length) return { ok: false, errors }
  const supplierName = input.supplierCandidate?.supplierName ?? proposal.supplier.legalNameCandidate.normalizedValue ?? proposal.supplier.rawName.normalizedValue
  if (!supplierName) return { ok: false, errors: ['El proveedor debe quedar identificado antes de confirmar.'] }
  return {
    ok: true,
    source: 'human-confirmed-normalized-proposal',
    payload: {
      expense_date: expenseDate!, supplier_name: supplierName, supplier_tax_id: input.supplierCandidate?.supplierTaxId ?? proposal.supplier.taxId.normalizedValue,
      category: category!, description: description!, document_type: documentType(proposal.documentType.normalizedValue), reference_number: proposal.invoice.number.normalizedValue,
      currency: currency!, subtotal: subtotal!, tax_rate: proposal.vatLines[0]?.rate.normalizedValue ? Number(proposal.vatLines[0].rate.normalizedValue) : 0,
      tax_amount: taxAmount!, total: total!, payment_method: input.paymentMethod, payment_status: 'paid',
      document_support_status: 'pending_review', fiscal_review_status: 'pending', fiscal_risk_level: 'medium', notes: input.notes?.trim() || null,
    },
  }
}
