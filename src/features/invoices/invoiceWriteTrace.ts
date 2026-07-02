type JsonRecord = Record<string, unknown>

interface InvoiceWriteTrace {
  expectedDisplayCode?: string | null
  expectedInvoiceNumber?: string | null
  sourceFlow: string
  writeApiVersion: string
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function withInvoiceWriteTrace(
  pricingMetadata: JsonRecord | null | undefined,
  trace: InvoiceWriteTrace,
): JsonRecord {
  const nextMetadata = isPlainRecord(pricingMetadata) ? { ...pricingMetadata } : {}

  nextMetadata.write_api_version = trace.writeApiVersion
  nextMetadata.source_flow = trace.sourceFlow

  if (trace.expectedInvoiceNumber) {
    nextMetadata.expected_invoice_number = trace.expectedInvoiceNumber
  }

  if (trace.expectedDisplayCode) {
    nextMetadata.expected_display_code = trace.expectedDisplayCode
  }

  return nextMetadata
}
