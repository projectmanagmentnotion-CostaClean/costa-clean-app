import { decimalAbsDifference, decimalAdd, decimalCompare, decimalPercent } from './expenseNormalizationDecimals.ts'
import type { NormalizedField, ReconciliationStatus, ValidationIssue } from './expenseNormalizationContract.ts'
function issue(code: string, field: string, severity: ValidationIssue['severity'], blocking: boolean, messageSafe: string): ValidationIssue { return { code, field, severity, blocking, messageSafe } }
const present = (field: NormalizedField<string>) => field.normalizedValue !== null && field.status === 'VALID'
export function reconcileAmounts(amounts: Record<'net' | 'tax' | 'gross' | 'discount' | 'withholding', NormalizedField<string>>, vatLines: Array<{ rate: NormalizedField<string>; base: NormalizedField<string>; tax: NormalizedField<string> }>): { status: ReconciliationStatus; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const hasAdjustment = present(amounts.discount) || present(amounts.withholding)
  if (hasAdjustment) return { status: 'COMPLEX_ADJUSTMENT', issues }
  const bases = vatLines.map((line) => line.base.normalizedValue as string)
  const taxes = vatLines.map((line) => line.tax.normalizedValue as string)
  const checks: Array<[string, string | null, string[], string]> = [
    ['VAT_BASE_SUM_MISMATCH', amounts.net.normalizedValue, bases, 'amounts.net'],
    ['VAT_TAX_SUM_MISMATCH', amounts.tax.normalizedValue, taxes, 'amounts.tax'],
  ]
  let insufficient = false
  for (const [code, expected, values, field] of checks) {
    const complete = vatLines.length > 0 && (field === 'amounts.net' ? vatLines.every((line) => present(line.base)) : vatLines.every((line) => present(line.tax)))
    if (expected === null || values.length === 0 || !complete) { insufficient = true; continue }
    const sum = values.reduce((total, value) => decimalAdd(total, value), '0.00')
    if (decimalCompare(decimalAbsDifference(sum, expected), '0.01') > 0) issues.push(issue(code, field, 'ERROR', true, `${code} requires manual review`))
  }
  for (const [index, line] of vatLines.entries()) {
    if (!present(line.rate) || !present(line.base) || !present(line.tax)) continue
    const expectedTax = decimalPercent(line.base.normalizedValue as string, line.rate.normalizedValue as string)
    if (decimalCompare(decimalAbsDifference(expectedTax, line.tax.normalizedValue as string), '0.01') > 0) issues.push(issue('VAT_LINE_TAX_MISMATCH', `vatLines[${index}].tax`, 'ERROR', true, 'VAT line tax does not reconcile with base and rate'))
  }
  if (amounts.net.normalizedValue === null || amounts.tax.normalizedValue === null || amounts.gross.normalizedValue === null) insufficient = true
  else if (decimalCompare(decimalAbsDifference(decimalAdd(amounts.net.normalizedValue, amounts.tax.normalizedValue), amounts.gross.normalizedValue), '0.01') > 0) issues.push(issue('TOTAL_MISMATCH', 'amounts.gross', 'ERROR', true, 'gross does not reconcile with net and tax'))
  if (issues.length) return { status: 'MISMATCH', issues }
  return { status: insufficient ? 'INSUFFICIENT_DATA' : 'MATCH', issues }
}
export function deriveReviewStatus(issues: ValidationIssue[], reconciliation: ReconciliationStatus): 'READY_FOR_REVIEW' | 'NEEDS_ATTENTION' | 'BLOCKED' {
  if (issues.some((item) => item.blocking && item.severity === 'ERROR') || reconciliation === 'MISMATCH') return 'BLOCKED'
  if (issues.some((item) => item.severity === 'WARNING') || reconciliation === 'INSUFFICIENT_DATA' || reconciliation === 'COMPLEX_ADJUSTMENT') return 'NEEDS_ATTENTION'
  return 'READY_FOR_REVIEW'
}
export { issue }
