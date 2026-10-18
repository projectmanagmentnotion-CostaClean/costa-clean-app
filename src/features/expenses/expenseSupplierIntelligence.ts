import type { ExpenseListItem } from './types'
import type { NormalizedExpenseProposal } from './expenseNormalizationContract'

export type SupplierMatchLevel = 'EXACT_TAX_ID' | 'EXACT_NAME' | 'STRONG_NAME' | 'WEAK_CONTEXT' | 'NO_MATCH'
export type DuplicateLevel = 'EXACT' | 'HIGH' | 'POSSIBLE'

export interface SupplierIdentityCandidate {
  expenseId: string
  supplierName: string
  supplierTaxId: string | null
  score: number
  level: SupplierMatchLevel
  reasons: string[]
}

export interface ExpenseDuplicateCandidate {
  expenseId: string
  level: DuplicateLevel
  score: number
  reasons: string[]
}

export interface SupplierIntelligenceResult {
  candidates: SupplierIdentityCandidate[]
  duplicates: ExpenseDuplicateCandidate[]
}

function fold(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}

export function normalizeSupplierTaxId(value: string | null | undefined): string | null {
  const normalized = (value ?? '').toUpperCase().replace(/[\s-]+/gu, '').trim()
  return normalized || null
}

function numberValue(value: string | null | undefined): number | null {
  if (!value || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function supplierName(proposal: NormalizedExpenseProposal): string | null {
  for (const key of ['legalNameCandidate', 'commercialNameCandidate', 'rawName']) {
    const value = proposal.supplier[key]?.normalizedValue?.trim()
    if (value) return value
  }
  return null
}

function supplierTaxId(proposal: NormalizedExpenseProposal): string | null {
  return normalizeSupplierTaxId(proposal.supplier.normalizedTaxIdCandidate?.normalizedValue ?? proposal.supplier.taxId?.normalizedValue)
}

export function findSupplierCandidates(proposal: NormalizedExpenseProposal, expenses: ExpenseListItem[]): SupplierIdentityCandidate[] {
  const wantedName = fold(supplierName(proposal))
  const wantedTaxId = supplierTaxId(proposal)
  if (!wantedName && !wantedTaxId) return []

  return expenses.map((expense) => {
    const reasons: string[] = []
    const existingTaxId = normalizeSupplierTaxId(expense.supplier_tax_id)
    const existingName = fold(expense.supplier_name)
    let score = 0
    let level: SupplierMatchLevel = 'NO_MATCH'
    if (wantedTaxId && existingTaxId && wantedTaxId === existingTaxId) {
      score = 100; level = 'EXACT_TAX_ID'; reasons.push('El identificador fiscal coincide exactamente.')
    } else if (wantedName && existingName === wantedName) {
      score = 85; level = 'EXACT_NAME'; reasons.push('El nombre normalizado coincide exactamente.')
    } else if (wantedName && existingName && (existingName.includes(wantedName) || wantedName.includes(existingName))) {
      score = 65; level = 'STRONG_NAME'; reasons.push('El nombre normalizado comparte una coincidencia fuerte.')
    }
    return { expenseId: expense.id, supplierName: expense.supplier_name, supplierTaxId: existingTaxId, score, level, reasons }
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.expenseId.localeCompare(b.expenseId))
}

export function findExpenseDuplicates(proposal: NormalizedExpenseProposal, expenses: ExpenseListItem[]): ExpenseDuplicateCandidate[] {
  const candidates = findSupplierCandidates(proposal, expenses)
  const issueDate = proposal.invoice.issueDate.normalizedValue
  const invoiceNumber = fold(proposal.invoice.number.normalizedValue)
  const gross = numberValue(proposal.amounts.gross.normalizedValue)
  return candidates.map((candidate) => {
    const expense = expenses.find((item) => item.id === candidate.expenseId)
    if (!expense) return null
    const reasons = [...candidate.reasons]
    const sameNumber = Boolean(invoiceNumber && fold(expense.reference_number) === invoiceNumber)
    const sameDate = Boolean(issueDate && expense.expense_date.slice(0, 10) === issueDate)
    const sameGross = gross !== null && Math.abs(expense.total - gross) < 0.005
    let score = candidate.score
    if (sameNumber) { score += 40; reasons.push('El número de documento coincide.') }
    if (sameDate) { score += 10; reasons.push('La fecha coincide.') }
    if (sameGross) { score += 20; reasons.push('El total coincide.') }
    const level: DuplicateLevel | null = sameNumber && candidate.score >= 85 ? 'EXACT' : score >= 105 ? 'HIGH' : score >= 85 && (sameDate || sameGross) ? 'POSSIBLE' : null
    return level ? { expenseId: expense.id, level, score, reasons } : null
  }).filter((candidate): candidate is ExpenseDuplicateCandidate => candidate !== null).sort((a, b) => b.score - a.score || a.expenseId.localeCompare(b.expenseId))
}

export function buildExpenseSupplierIntelligence(proposal: NormalizedExpenseProposal, expenses: ExpenseListItem[]): SupplierIntelligenceResult {
  return { candidates: findSupplierCandidates(proposal, expenses), duplicates: findExpenseDuplicates(proposal, expenses) }
}
