import type { ExpenseFiscalIntelligenceResult, ExpenseListItem } from './types'

export const expenseFiscalIntelligenceSourceVersion = 'spain-autonomo-expense-rules-2026-04-13'

const lowRiskOperationalCategories = new Set([
  'productos_limpieza',
  'herramientas',
  'materiales',
  'lavanderia',
  'gestoria',
  'software',
  'seguros',
  'publicidad_marketing',
  'servicios_profesionales',
  'mantenimiento',
])

const mixedUseCategories = new Set([
  'telefonia',
  'suministros',
  'transporte',
  'combustible',
  'dietas_viajes',
  'alquiler',
])

function roundMoney(value: number): number {
  return Number(value.toFixed(2))
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))))
}

function hasValidInvoiceSupport(expense: ExpenseListItem): boolean {
  return (
    expense.document_support_status === 'invoice_valid' &&
    expense.document_type === 'factura' &&
    Boolean(expense.receipt_file_path)
  )
}

function hasWeakOrMissingSupport(expense: ExpenseListItem): boolean {
  return (
    expense.document_support_status === 'missing' ||
    !expense.receipt_file_path
  )
}

export function buildExpenseFiscalPrecheck(expense: ExpenseListItem): ExpenseFiscalIntelligenceResult {
  const flags = new Set<string>()
  const category = String(expense.category ?? 'otros')
  const subtotal = Number(expense.subtotal || 0)
  const taxAmount = Number(expense.tax_amount || 0)
  const taxRate = Number(expense.tax_rate || 0)
  const validInvoiceSupport = hasValidInvoiceSupport(expense)
  const weakOrMissingSupport = hasWeakOrMissingSupport(expense)

  let classification: ExpenseFiscalIntelligenceResult['classification'] = 'requires_review'
  let deductibilityPercentage = 0
  let vatDeductibilityPercentage = 0
  let confidence = 0.52
  let riskLevel: ExpenseFiscalIntelligenceResult['risk_level'] = 'medium'
  let reviewRecommendation: ExpenseFiscalIntelligenceResult['review_recommendation'] = 'user_review'
  const reasons: string[] = []
  const questionsForUser: string[] = []

  if (weakOrMissingSupport) {
    flags.add('missing_or_weak_document_support')
    reasons.push('Falta soporte documental suficiente para una estimacion fiscal fuerte.')
    questionsForUser.push('Sube una factura o soporte valido antes de cerrar el periodo.')
  }

  if (!validInvoiceSupport) {
    flags.add('vat_requires_valid_invoice_review')
    reasons.push('Para IVA se aplica un criterio mas estricto: conviene revisar si existe factura valida.')
  }

  if (taxAmount <= 0 || taxRate <= 0) {
    flags.add('zero_or_invalid_vat_amount')
    reasons.push('El IVA soportado es cero o no parece valido, por lo que la estimacion de IVA deducible queda en cero.')
  }

  if (!expense.supplier_tax_id) {
    flags.add('missing_supplier_tax_id')
  }

  if (lowRiskOperationalCategories.has(category)) {
    flags.add('operational_category')
    classification = validInvoiceSupport ? 'probably_deductible' : 'requires_review'
    deductibilityPercentage = weakOrMissingSupport ? 0 : 100
    vatDeductibilityPercentage = validInvoiceSupport && taxAmount > 0 && taxRate > 0 ? 100 : 0
    confidence = validInvoiceSupport ? 0.74 : 0.58
    riskLevel = validInvoiceSupport ? 'low' : 'medium'
    reviewRecommendation = validInvoiceSupport ? 'no_review_needed' : 'user_review'
    reasons.push('La categoria encaja con gastos operativos habituales de una actividad de limpieza.')
  } else if (mixedUseCategories.has(category)) {
    flags.add('mixed_private_use_possible')
    classification = weakOrMissingSupport ? 'requires_review' : 'partially_deductible'
    deductibilityPercentage = weakOrMissingSupport ? 0 : 50
    vatDeductibilityPercentage = validInvoiceSupport && taxAmount > 0 && taxRate > 0 ? 50 : 0
    confidence = validInvoiceSupport ? 0.62 : 0.5
    riskLevel = 'medium'
    reviewRecommendation = 'user_review'
    reasons.push('La categoria puede tener uso mixto profesional/privado y debe tratarse de forma prudente.')
    questionsForUser.push('Confirma que parte del gasto corresponde realmente a la actividad profesional.')
  } else {
    flags.add('ambiguous_category')
    classification = 'requires_review'
    deductibilityPercentage = weakOrMissingSupport ? 0 : 50
    vatDeductibilityPercentage = validInvoiceSupport && taxAmount > 0 && taxRate > 0 ? 50 : 0
    confidence = 0.48
    riskLevel = 'medium'
    reviewRecommendation = 'user_review'
    reasons.push('La categoria no permite una estimacion automatica fuerte sin mas contexto.')
    questionsForUser.push('Aclara la relacion directa del gasto con la actividad de CostaClean.')
  }

  if (weakOrMissingSupport) {
    classification = 'requires_review'
    deductibilityPercentage = 0
    vatDeductibilityPercentage = 0
    riskLevel = 'high'
    reviewRecommendation = 'gestoria_review'
    confidence = Math.min(confidence, 0.55)
  }

  if (category === 'impuestos_tasas') {
    flags.add('tax_or_fee_category')
    classification = 'requires_review'
    vatDeductibilityPercentage = 0
    riskLevel = 'medium'
    reviewRecommendation = 'gestoria_review'
    reasons.push('Impuestos y tasas requieren revision especifica antes de estimar deducibilidad.')
  }

  const deductibleBase = roundMoney(subtotal * clampPercentage(deductibilityPercentage) / 100)
  const deductibleVat = roundMoney(taxAmount * clampPercentage(vatDeductibilityPercentage) / 100)

  return {
    classification,
    deductibility_percentage: clampPercentage(deductibilityPercentage),
    vat_deductibility_percentage: clampPercentage(vatDeductibilityPercentage),
    estimated_deductible_base: deductibleBase,
    estimated_deductible_vat: deductibleVat,
    confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
    risk_level: riskLevel,
    reasoning: reasons.join(' '),
    flags: [...flags],
    review_recommendation: reviewRecommendation,
    questions_for_user: questionsForUser,
    assistive_notice: 'Estimacion orientativa basada en datos estructurados del gasto. No sustituye la revision de una gestoria ni constituye asesoramiento fiscal.',
  }
}
