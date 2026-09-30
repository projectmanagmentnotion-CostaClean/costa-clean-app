import type { ExtractionEvidence, ExtractionProposal, ExtractedField } from './expenseExtractionContract'

export const NORMALIZATION_SCHEMA_VERSION = 1 as const
export type NormalizationStatus = 'VALID' | 'MISSING' | 'AMBIGUOUS' | 'INVALID' | 'CONFLICT'
export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR'
export interface ValidationIssue { code: string; severity: ValidationSeverity; field: string; messageSafe: string; blocking: boolean; detailsSafe?: Record<string, string | number | boolean | null> }
export interface NormalizedField<T> {
  rawValue: string | null
  extractedValue: T | null
  normalizedValue: T | null
  confidence: number | null
  source: ExtractedField<unknown>['source']
  evidence?: ExtractionEvidence
  status: NormalizationStatus
  issues: ValidationIssue[]
}
export type ReconciliationStatus = 'MATCH' | 'MISMATCH' | 'INSUFFICIENT_DATA' | 'COMPLEX_ADJUSTMENT'
export type ReviewStatus = 'READY_FOR_REVIEW' | 'NEEDS_ATTENTION' | 'BLOCKED'
export interface NormalizedExpenseProposal {
  schemaVersion: typeof NORMALIZATION_SCHEMA_VERSION
  extraction: ExtractionProposal
  documentType: NormalizedField<string>
  supplier: Record<string, NormalizedField<string>>
  invoice: { number: NormalizedField<string>; issueDate: NormalizedField<string>; dueDate: NormalizedField<string>; currency: NormalizedField<string> }
  amounts: Record<'net' | 'tax' | 'gross' | 'discount' | 'withholding', NormalizedField<string>>
  vatLines: Array<{ rate: NormalizedField<string>; base: NormalizedField<string>; tax: NormalizedField<string> }>
  payment: { method: NormalizedField<string> }
  confidence: { overall: number | null }
  issues: ValidationIssue[]
  reconciliation: { status: ReconciliationStatus; issues: ValidationIssue[] }
  reviewStatus: ReviewStatus
}
