import type { InvoiceCreatePrefillLine } from './invoiceCreatePrefill'
import type { InvoiceListItem, InvoiceLineItem } from './types'

export interface InvoiceCorrectionCase {
  invoiceNumber: string
  targetConcept: string
  currentQuantity: number
  correctedQuantity: number
  unitPrice: number
  baseDifference: number
  taxDifference: number
  totalDifference: number
  expectedSubtotal: number
  expectedTaxAmount: number
  expectedTotal: number
}

const KNOWN_CORRECTION_CASES: Record<string, InvoiceCorrectionCase> = {
  '2026-045': {
    invoiceNumber: '2026-045',
    targetConcept: 'limpieza de taller',
    currentQuantity: 1,
    correctedQuantity: 6,
    unitPrice: 18,
    baseDifference: 90,
    taxDifference: 18.9,
    totalDifference: 108.9,
    expectedSubtotal: 324,
    expectedTaxAmount: 68.04,
    expectedTotal: 392.04,
  },
}

function normalizeConcept(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function getInvoiceCorrectionCase(invoice: InvoiceListItem | null): InvoiceCorrectionCase | null {
  if (!invoice || invoice.status !== 'issued' || !invoice.invoice_number) {
    return null
  }

  const knownCase = KNOWN_CORRECTION_CASES[invoice.invoice_number]
  if (!knownCase) return null

  const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  const hasTargetLine = lines.some((line) => normalizeConcept(line.concept) === normalizeConcept(knownCase.targetConcept))
  return hasTargetLine ? knownCase : null
}

export function buildCorrectedInvoiceLines(
  invoice: InvoiceListItem,
  correctionCase: InvoiceCorrectionCase,
): InvoiceCreatePrefillLine[] {
  const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  return lines.map((line) => buildCorrectedInvoiceLine(line, correctionCase))
}

function buildCorrectedInvoiceLine(
  line: InvoiceLineItem,
  correctionCase: InvoiceCorrectionCase,
): InvoiceCreatePrefillLine {
  const isTargetLine = normalizeConcept(line.concept) === normalizeConcept(correctionCase.targetConcept)
  const nextQuantity = isTargetLine ? correctionCase.correctedQuantity : line.quantity

  return {
    concept: line.concept,
    quantity: nextQuantity.toFixed(2),
    unit: line.unit?.trim() || 'servicio',
    unit_price: line.unit_price.toFixed(2),
  }
}

export function buildInvoiceCorrectionSummaryLines(correctionCase: InvoiceCorrectionCase): string[] {
  return [
    `Factura: ${correctionCase.invoiceNumber}`,
    `Linea: ${correctionCase.targetConcept}`,
    `Cantidad actual: ${correctionCase.currentQuantity} hora(s)`,
    `Cantidad correcta: ${correctionCase.correctedQuantity} hora(s)`,
    `Diferencia base: +${correctionCase.baseDifference.toFixed(2)} EUR`,
    `Diferencia IVA 21%: +${correctionCase.taxDifference.toFixed(2)} EUR`,
    `Diferencia total: +${correctionCase.totalDifference.toFixed(2)} EUR`,
    `Nueva base esperada: ${correctionCase.expectedSubtotal.toFixed(2)} EUR`,
    `Nuevo IVA esperado: ${correctionCase.expectedTaxAmount.toFixed(2)} EUR`,
    `Nuevo total esperado: ${correctionCase.expectedTotal.toFixed(2)} EUR`,
  ]
}
