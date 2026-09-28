import {
  EXPENSE_EXTRACTION_SCHEMA_VERSION,
  createMissingField,
  validateExtractionProposal,
  type ExtractionErrorCode,
  type ExtractionProposal,
  type ExtractionProviderMetadata,
} from './expenseExtractionContract'

export interface ExtractionProviderInput {
  captureDocumentId: string
  captureSessionId: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

export type ExtractionProviderResult =
  | { ok: true; proposal: ExtractionProposal; metadata: ExtractionProviderMetadata }
  | { ok: false; errorCode: ExtractionErrorCode; errorMessageSafe: string; metadata: ExtractionProviderMetadata }

export interface DocumentExtractionProvider {
  readonly metadata: ExtractionProviderMetadata
  extractDocument(input: ExtractionProviderInput): Promise<ExtractionProviderResult>
}

function field<T>(value: T, rawValue: string, confidence: number, page = 1) {
  return { value, rawValue, confidence, source: 'document' as const, evidence: { page, text: rawValue } }
}

function fixtureProposal(): ExtractionProposal {
  return {
    schemaVersion: EXPENSE_EXTRACTION_SCHEMA_VERSION,
    documentType: field('INVOICE', 'FACTURA', 0.98),
    supplier: {
      rawName: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.97), legalNameCandidate: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.94), commercialNameCandidate: field('Costa Test', 'COSTA TEST', 0.92), taxId: field('B12345678', 'CIF: B-12345678', 0.99), normalizedTaxIdCandidate: field('B12345678', 'B-12345678', 0.96), vatId: createMissingField(), address: createMissingField(), postalCode: createMissingField(), city: createMissingField(), country: field('ES', 'España', 0.88), phone: createMissingField(), email: createMissingField(), website: createMissingField(),
    },
    invoice: { number: field('TEST-2026-001', 'TEST-2026-001', 0.96), issueDate: field('2026-09-28', '28/09/2026', 0.95), dueDate: createMissingField(), currency: field('EUR', 'EUR', 0.99) },
    amounts: { net: field('150.00', '150,00 €', 0.98), tax: field('26.00', '26,00 €', 0.98), gross: field('176.00', '176,00 €', 0.98), discount: createMissingField(), withholding: createMissingField() },
    vatLines: [
      { rate: field('10', 'IVA 10%', 0.82), base: field('50.00', 'Base 10%: 50,00 €', 0.8), tax: field('5.00', 'IVA 10%: 5,00 €', 0.8) },
      { rate: field('21', 'IVA 21%', 0.96), base: field('100.00', 'Base 21%: 100,00 €', 0.95), tax: field('21.00', 'IVA 21%: 21,00 €', 0.95) },
    ],
    payment: { method: createMissingField() },
    confidence: { overall: 0.94 },
  }
}

export function createFixtureExtractionProvider(): DocumentExtractionProvider {
  const metadata: ExtractionProviderMetadata = { provider: 'fixture', providerVersion: 'n5.2-fixture-v1', model: null }
  return {
    metadata,
    async extractDocument(input) {
      if (!input.originalFilename.toLowerCase().startsWith('fixture-')) return { ok: false, errorCode: 'UNSUPPORTED_DOCUMENT', errorMessageSafe: 'El proveedor fixture solo procesa documentos de prueba identificados como fixture.', metadata }
      const checked = validateExtractionProposal(fixtureProposal())
      if (!checked.ok) return { ok: false, errorCode: 'INVALID_PROVIDER_RESPONSE', errorMessageSafe: 'La propuesta fixture no supera la validación estructural.', metadata }
      return { ok: true, proposal: checked.proposal, metadata }
    },
  }
}
