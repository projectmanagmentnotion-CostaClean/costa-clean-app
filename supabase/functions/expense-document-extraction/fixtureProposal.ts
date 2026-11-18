type JsonRecord = Record<string, unknown>

const field = (value: string, rawValue: string, confidence: number, page = 1) => ({ value, rawValue, confidence, source: 'document', evidence: { page, text: rawValue } })
export const missing = () => ({ value: null, rawValue: null, confidence: null, source: 'missing' })

export const createServerFixtureProposal = (profile: 'standard' | 'synthetic-pdf' | 'synthetic-image' = 'standard'): JsonRecord => {
  const isPdf = profile === 'synthetic-pdf'
  const isImage = profile === 'synthetic-image'
  const supplierName = isPdf ? 'Proveedor Ficticio Norte S.L.' : isImage ? 'Suministros Demo Mediterraneo S.L.' : 'SUMINISTROS COSTA TEST S.L.'
  const taxId = isPdf ? 'B00000002' : isImage ? 'B00000001' : 'B12345674'
  const invoiceNumber = isPdf ? 'SYN-PDF-2026-001' : isImage ? 'SYN-IMG-2026-002' : 'TEST-2026-001'
  const issueDate = isPdf ? '2026-11-12' : isImage ? '2026-11-13' : '2026-09-28'
  const net = isPdf ? '100.00' : isImage ? '80.00' : '150.00'
  const tax = isPdf ? '21.00' : isImage ? '16.80' : '26.00'
  const gross = isPdf ? '121.00' : isImage ? '96.80' : '176.00'
  const vatLines = isPdf || isImage
    ? [{ rate: field('21', 'IVA 21%', 0.99), base: field(net, `Base ${net} EUR`, 0.99), tax: field(tax, `IVA ${tax} EUR`, 0.99) }]
    : [
      { rate: field('10', 'IVA 10%', 0.82), base: field('50.00', 'Base 10%: 50,00 €', 0.8), tax: field('5.00', 'IVA 10%: 5,00 €', 0.8) },
      { rate: field('21', 'IVA 21%', 0.96), base: field('100.00', 'Base 21%: 100,00 €', 0.95), tax: field('21.00', 'IVA 21%: 21,00 €', 0.95) },
    ]
  return ({
  schemaVersion: 1,
  documentType: field('INVOICE', 'FACTURA', 0.98),
  supplier: {
    rawName: field(supplierName, supplierName, 0.97),
    legalNameCandidate: field(supplierName, supplierName, 0.94),
    commercialNameCandidate: field(supplierName, supplierName, 0.92),
    taxId: field(taxId, `NIF FICTICIO NO VALIDO: ${taxId}`, 0.99),
    normalizedTaxIdCandidate: field(taxId, taxId, 0.96),
    vatId: missing(), address: missing(), postalCode: missing(), city: missing(),
    country: field('ES', 'España', 0.88), phone: missing(), email: missing(), website: missing(),
  },
  invoice: {
    number: field(invoiceNumber, invoiceNumber, 0.96),
    issueDate: field(issueDate, issueDate, 0.95),
    dueDate: missing(), currency: field('EUR', 'EUR', 0.99),
  },
  amounts: {
    net: field(net, net, 0.98), tax: field(tax, tax, 0.98),
    gross: field(gross, gross, 0.98), discount: missing(), withholding: missing(),
  },
  vatLines,
  payment: { method: missing() },
  confidence: { overall: 0.94 },
})
}

export function resolveSyntheticDocumentProfile(filename: string): 'synthetic-pdf' | 'synthetic-image' | null {
  const normalized = filename.trim().toLowerCase()
  if (normalized === 'smart-expense-synthetic-invoice.pdf') return 'synthetic-pdf'
  if (normalized === 'smart-expense-synthetic-invoice.png') return 'synthetic-image'
  return null
}
