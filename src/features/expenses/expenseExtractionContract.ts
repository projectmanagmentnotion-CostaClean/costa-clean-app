export const EXPENSE_EXTRACTION_SCHEMA_VERSION = 1 as const

export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
export type KnownExtractionProviderId = 'fixture' | 'google-document-ai' | 'azure-document-intelligence' | 'openai'
export type ExtractionProviderId = KnownExtractionProviderId | (string & {})
export type ExtractionDocumentType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'OTHER' | 'UNKNOWN'
export type ExtractionSource = 'document' | 'provider' | 'missing'
export type DecimalString = `${number}`

export interface ExtractionEvidence {
  page?: number
  text?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export interface ExtractedField<T> {
  value: T | null
  rawValue: string | null
  confidence: number | null
  source: ExtractionSource
  evidence?: ExtractionEvidence
}

export interface SupplierExtraction {
  rawName: ExtractedField<string>
  legalNameCandidate: ExtractedField<string>
  commercialNameCandidate: ExtractedField<string>
  taxId: ExtractedField<string>
  normalizedTaxIdCandidate: ExtractedField<string>
  vatId: ExtractedField<string>
  address: ExtractedField<string>
  postalCode: ExtractedField<string>
  city: ExtractedField<string>
  country: ExtractedField<string>
  phone: ExtractedField<string>
  email: ExtractedField<string>
  website: ExtractedField<string>
}

export interface InvoiceExtraction {
  number: ExtractedField<string>
  issueDate: ExtractedField<string>
  dueDate: ExtractedField<string>
  currency: ExtractedField<string>
}

export interface AmountExtraction {
  net: ExtractedField<DecimalString>
  tax: ExtractedField<DecimalString>
  gross: ExtractedField<DecimalString>
  discount: ExtractedField<DecimalString>
  withholding: ExtractedField<DecimalString>
}

export interface VatExtractionLine {
  rate: ExtractedField<DecimalString>
  base: ExtractedField<DecimalString>
  tax: ExtractedField<DecimalString>
}

export interface ExtractionProposal {
  schemaVersion: typeof EXPENSE_EXTRACTION_SCHEMA_VERSION
  documentType: ExtractedField<ExtractionDocumentType>
  supplier: SupplierExtraction
  invoice: InvoiceExtraction
  amounts: AmountExtraction
  vatLines: VatExtractionLine[]
  payment: { method: ExtractedField<string> }
  confidence: { overall: number | null }
}

export interface ExtractionProviderMetadata {
  provider: ExtractionProviderId
  providerVersion: string
  model: string | null
}

export interface ExtractionProviderInput {
  captureDocumentId: string
  captureSessionId: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

export type ExtractionProviderResult =
  | { ok: true; extractionId: string; attempt: number; proposal: ExtractionProposal; metadata: ExtractionProviderMetadata }
  | { ok: false; errorCode: ExtractionErrorCode; errorMessageSafe: string; metadata: ExtractionProviderMetadata | null }

export interface ExtractionAttemptIdentity {
  captureDocumentId: string
  captureSessionId: string
  documentSha256: string
  schemaVersion: typeof EXPENSE_EXTRACTION_SCHEMA_VERSION
  provider: ExtractionProviderId
  attempt: number
  idempotencyKey: string
}

export interface ExtractionAttemptRecord extends ExtractionAttemptIdentity, ExtractionProviderMetadata {
  id: string
  status: ExtractionStatus
  proposal: ExtractionProposal | null
  rawText: string | null
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  errorCode: string | null
  errorMessageSafe: string | null
  createdAt: string
  updatedAt: string
}

export const EXTRACTION_ERROR_CODES = [
  'UNSUPPORTED_DOCUMENT',
  'EXTRACTION_RUNTIME_NOT_CONFIGURED',
  'EXTRACTION_PROVIDER_UNAVAILABLE',
  'EXTRACTION_TIMEOUT',
  'EXTRACTION_RATE_LIMITED',
  'EXTRACTION_REFUSED',
  'DOCUMENT_INVALID',
  'INVALID_PROVIDER_RESPONSE',
  'DOCUMENT_NOT_FOUND',
  'DOCUMENT_ACCESS_DENIED',
  'EXTRACTION_FAILED',
] as const

export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number]

const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === 'string' && decimalPattern.test(value)
}

export function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export function createMissingField<T>(): ExtractedField<T> {
  return { value: null, rawValue: null, confidence: null, source: 'missing' }
}

function isEvidence(value: unknown): value is ExtractionEvidence {
  if (!value || typeof value !== 'object') return false
  const evidence = value as Record<string, unknown>
  if (evidence.page !== undefined && evidence.page !== null && (!Number.isInteger(evidence.page) || Number(evidence.page) < 1)) return false
  if (evidence.text !== undefined && evidence.text !== null && typeof evidence.text !== 'string') return false
  if (evidence.boundingBox !== undefined) {
    const box = evidence.boundingBox
    if (!box || typeof box !== 'object' || !['x', 'y', 'width', 'height'].every((key) => {
      const coordinate = (box as Record<string, unknown>)[key]
      return typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0
    })) return false
  }
  return true
}

export function isExtractedField(value: unknown): value is ExtractedField<unknown> {
  if (!value || typeof value !== 'object') return false
  const field = value as Record<string, unknown>
  return Object.prototype.hasOwnProperty.call(field, 'value')
    && Object.prototype.hasOwnProperty.call(field, 'rawValue')
    && Object.prototype.hasOwnProperty.call(field, 'confidence')
    && Object.prototype.hasOwnProperty.call(field, 'source')
    && (field.value === null || typeof field.value === 'string')
    && (field.rawValue === null || typeof field.rawValue === 'string')
    && (field.confidence === null || isConfidence(field.confidence))
    && ['document', 'provider', 'missing'].includes(String(field.source))
    && (field.source !== 'missing' || (field.value === null && field.rawValue === null && field.confidence === null))
    && (field.evidence === undefined || isEvidence(field.evidence))
}

function requireStringField(parent: Record<string, unknown> | undefined, key: string, errors: string[], label = key) {
  const field = parent?.[key]
  if (!isExtractedField(field) || (field.value !== null && typeof field.value !== 'string')) errors.push(`${label} must be a string extracted field`)
}

function requireStringFieldGroup(parent: unknown, prefix: string, keys: string[], errors: string[]) {
  const record = parent && typeof parent === 'object' ? parent as Record<string, unknown> : undefined
  if (!record) { errors.push(`${prefix} must be an object`); return }
  keys.forEach((key) => requireStringField(record, key, errors, `${prefix}.${key}`))
}

export function validateExtractionProposal(input: unknown): { ok: true; proposal: ExtractionProposal } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!input || typeof input !== 'object') return { ok: false, errors: ['proposal must be an object'] }
  const proposal = input as Record<string, unknown>
  if (proposal.schemaVersion !== EXPENSE_EXTRACTION_SCHEMA_VERSION) errors.push('unsupported schemaVersion')
  if (!isExtractedField(proposal.documentType) || (proposal.documentType.value !== null && !['INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'OTHER', 'UNKNOWN'].includes(String(proposal.documentType.value)))) errors.push('documentType must use an allowed value')
  requireStringFieldGroup(proposal.supplier, 'supplier', ['rawName', 'legalNameCandidate', 'commercialNameCandidate', 'taxId', 'normalizedTaxIdCandidate', 'vatId', 'address', 'postalCode', 'city', 'country', 'phone', 'email', 'website'], errors)
  requireStringFieldGroup(proposal.invoice, 'invoice', ['number', 'issueDate', 'dueDate', 'currency'], errors)
  const payment = proposal.payment && typeof proposal.payment === 'object' ? proposal.payment as Record<string, unknown> : undefined
  requireStringField(payment, 'method', errors, 'payment.method')
  const amounts = proposal.amounts as Record<string, unknown> | undefined
  for (const key of ['net', 'tax', 'gross', 'discount', 'withholding']) {
    const field = amounts?.[key]
    if (!isExtractedField(field) || (field.value !== null && !isDecimalString(field.value))) errors.push(`amounts.${key} must use a decimal string`)
  }
  if (!Array.isArray(proposal.vatLines)) errors.push('vatLines must be an array')
  else proposal.vatLines.forEach((line, index) => {
    const record = line as Record<string, unknown> | null
    for (const key of ['rate', 'base', 'tax']) {
      const field = record?.[key]
      if (!isExtractedField(field) || (field.value !== null && !isDecimalString(field.value))) errors.push(`vatLines[${index}].${key} must use a decimal string`)
    }
  })
  const confidenceRecord = proposal.confidence && typeof proposal.confidence === 'object' ? proposal.confidence as Record<string, unknown> : undefined
  if (!confidenceRecord) errors.push('confidence must be an object')
  const confidence = confidenceRecord?.overall
  if (confidence !== null && !isConfidence(confidence)) errors.push('confidence.overall must be null or between 0 and 1')
  if (errors.length) return { ok: false, errors }
  return { ok: true, proposal: input as ExtractionProposal }
}
