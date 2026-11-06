type JsonRecord = Record<string, unknown>

const field = (value: string, rawValue: string, confidence: number, page = 1) => ({ value, rawValue, confidence, source: 'document', evidence: { page, text: rawValue } })
export const missing = () => ({ value: null, rawValue: null, confidence: null, source: 'missing' })

export const createServerFixtureProposal = (): JsonRecord => ({
  schemaVersion: 1,
  documentType: field('INVOICE', 'FACTURA', 0.98),
  supplier: {
    rawName: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.97),
    legalNameCandidate: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.94),
    commercialNameCandidate: field('Costa Test', 'COSTA TEST', 0.92),
    taxId: field('B12345674', 'CIF: B-12345674', 0.99),
    normalizedTaxIdCandidate: field('B12345674', 'B-12345674', 0.96),
    vatId: missing(), address: missing(), postalCode: missing(), city: missing(),
    country: field('ES', 'España', 0.88), phone: missing(), email: missing(), website: missing(),
  },
  invoice: {
    number: field('TEST-2026-001', 'TEST-2026-001', 0.96),
    issueDate: field('2026-09-28', '28/09/2026', 0.95),
    dueDate: missing(), currency: field('EUR', 'EUR', 0.99),
  },
  amounts: {
    net: field('150.00', '150,00 €', 0.98), tax: field('26.00', '26,00 €', 0.98),
    gross: field('176.00', '176,00 €', 0.98), discount: missing(), withholding: missing(),
  },
  vatLines: [
    { rate: field('10', 'IVA 10%', 0.82), base: field('50.00', 'Base 10%: 50,00 €', 0.8), tax: field('5.00', 'IVA 10%: 5,00 €', 0.8) },
    { rate: field('21', 'IVA 21%', 0.96), base: field('100.00', 'Base 21%: 100,00 €', 0.95), tax: field('21.00', 'IVA 21%: 21,00 €', 0.95) },
  ],
  payment: { method: missing() },
  confidence: { overall: 0.94 },
})
