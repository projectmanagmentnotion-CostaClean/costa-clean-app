type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const isEvidence = (value: unknown) => {
  if (!isRecord(value)) return false
  if (value.page !== undefined && value.page !== null && (!Number.isInteger(value.page) || Number(value.page) < 1)) return false
  if (value.text !== undefined && value.text !== null && typeof value.text !== 'string') return false
  if (value.boundingBox !== undefined) {
    const boundingBox = isRecord(value.boundingBox) ? value.boundingBox : undefined
    if (!boundingBox || !['x', 'y', 'width', 'height'].every((key) => {
      const coordinate = boundingBox[key]
      return typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0
    })) return false
  }
  return true
}
const isConfidence = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
const isExtractedField = (value: unknown): value is JsonRecord => {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'value') || !Object.prototype.hasOwnProperty.call(value, 'rawValue') || !Object.prototype.hasOwnProperty.call(value, 'confidence') || !Object.prototype.hasOwnProperty.call(value, 'source')) return false
  if (value.value !== null && typeof value.value !== 'string') return false
  if (value.rawValue !== null && typeof value.rawValue !== 'string') return false
  if (!isConfidence(value.confidence) || !['document', 'provider', 'missing'].includes(String(value.source))) return false
  if (value.source === 'missing' && (value.value !== null || value.rawValue !== null || value.confidence !== null)) return false
  return value.evidence === undefined || isEvidence(value.evidence)
}
const isDecimalString = (value: unknown) => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
const requireStringField = (parent: JsonRecord | undefined, key: string) => {
  const field = parent?.[key]
  return isExtractedField(field) && (field.value === null || typeof field.value === 'string')
}
const requireStringFields = (parent: unknown, keys: string[]) => {
  if (!isRecord(parent)) return false
  return keys.every((key) => requireStringField(parent, key))
}

export const validateServerProposal = (input: unknown): input is JsonRecord => {
  if (!isRecord(input) || input.schemaVersion !== 1 || !isExtractedField(input.documentType)) return false
  if (input.documentType.value !== null && (typeof input.documentType.value !== 'string' || !['INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'OTHER', 'UNKNOWN'].includes(input.documentType.value))) return false
  if (!requireStringFields(input.supplier, ['rawName', 'legalNameCandidate', 'commercialNameCandidate', 'taxId', 'normalizedTaxIdCandidate', 'vatId', 'address', 'postalCode', 'city', 'country', 'phone', 'email', 'website'])) return false
  if (!requireStringFields(input.invoice, ['number', 'issueDate', 'dueDate', 'currency'])) return false
  if (!isRecord(input.payment) || !requireStringField(input.payment, 'method')) return false
  const amounts = isRecord(input.amounts) ? input.amounts : undefined
  if (!amounts || !['net', 'tax', 'gross', 'discount', 'withholding'].every((key) => {
    const field = amounts[key]
    return isExtractedField(field) && (field.value === null || isDecimalString(field.value))
  })) return false
  if (!Array.isArray(input.vatLines) || !input.vatLines.every((line) => isRecord(line) && ['rate', 'base', 'tax'].every((key) => {
    const field = line[key]
    return isExtractedField(field) && (field.value === null || isDecimalString(field.value))
  }))) return false
  return isRecord(input.confidence) && isConfidence(input.confidence.overall)
}
