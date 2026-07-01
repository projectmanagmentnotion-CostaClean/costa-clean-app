import { businessRules } from '../../app/businessRules'
import { formatCurrency } from '../../app/displayFormat'
import type { PropertyListItem } from '../properties/types'
import type { QuoteLineItem, QuoteListItem } from './types'
import { normalizeLineConcept, simplifyLineConcept } from './lineConcepts'

export interface QuoteLineFormState {
  local_id: string
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

export interface QuoteLinePayload {
  id: string
  quote_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
}

export function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatMoneyInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

export function formatQuantityInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

export function createBlankQuoteLine(): QuoteLineFormState {
  return {
    local_id: createLocalId('QUOTE-LINE-DRAFT'),
    concept: '',
    quantity: '1.00',
    unit: 'servicio',
    unit_price: '0.00',
  }
}

export function buildFallbackConcept(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): string {
  if (quote.property_id) {
    const property = properties.find((item) => item.id === quote.property_id)
    const propertyName = property?.name?.trim()
    if (propertyName) {
      return `Servicio de limpieza en ${propertyName}`
    }
  }

  return simplifyLineConcept(quote.notes, 'Servicio de limpieza')
}

export function quoteLineItemToFormLine(line: QuoteLineItem): QuoteLineFormState {
  return {
    local_id: line.id || createLocalId('QUOTE-LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: formatQuantityInput(Number(line.quantity)),
    unit: line.unit || 'servicio',
    unit_price: formatMoneyInput(Number(line.unit_price)),
  }
}

export function getFallbackLineFromQuote(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): QuoteLineFormState {
  const subtotal = Number(quote.subtotal)
  const safeSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0

  return {
    local_id: createLocalId('QUOTE-LINE-DRAFT'),
    concept: simplifyLineConcept(buildFallbackConcept(quote, properties), 'Servicio de limpieza'),
    quantity: '1.00',
    unit: 'servicio',
    unit_price: formatMoneyInput(safeSubtotal),
  }
}

export function getFormLinesFromQuote(
  quote: QuoteListItem,
  properties: PropertyListItem[],
): QuoteLineFormState[] {
  const persistedLines = quote.lines?.length ? quote.lines : quote.quote_lines ?? []
  if (persistedLines.length > 0) {
    return [...persistedLines]
      .sort((left, right) => Number(left.sort_order) - Number(right.sort_order))
      .map(quoteLineItemToFormLine)
  }

  return [getFallbackLineFromQuote(quote, properties)]
}

export function calculateQuoteLineSubtotal(line: QuoteLineFormState): number {
  const quantity = parseDecimalInput(line.quantity)
  const unitPrice = parseDecimalInput(line.unit_price)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN
  return roundMoney(quantity * unitPrice)
}

export function formatQuoteLineSubtotalInput(line: QuoteLineFormState): string {
  const lineSubtotal = calculateQuoteLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? '' : formatMoneyInput(lineSubtotal)
}

export function formatQuoteLineSubtotalDisplay(line: QuoteLineFormState): string {
  const lineSubtotal = calculateQuoteLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? 'Importe no válido' : formatCurrency(lineSubtotal)
}

export function calculateQuoteSubtotal(lines: QuoteLineFormState[]): number {
  return roundMoney(lines.reduce((sum, line) => {
    const lineSubtotal = calculateQuoteLineSubtotal(line)
    return Number.isNaN(lineSubtotal) ? sum : sum + lineSubtotal
  }, 0))
}

export function calculateQuoteTax(lines: QuoteLineFormState[]): number {
  return roundMoney(calculateQuoteSubtotal(lines) * businessRules.defaultTaxRate)
}

export function calculateQuoteTotal(lines: QuoteLineFormState[]): number {
  const subtotal = calculateQuoteSubtotal(lines)
  const tax = roundMoney(subtotal * businessRules.defaultTaxRate)
  return roundMoney(subtotal + tax)
}

export function buildQuoteLinePayloads(
  lines: QuoteLineFormState[],
  quoteId: string,
): QuoteLinePayload[] | null {
  const payloads: QuoteLinePayload[] = []

  for (const [index, line] of lines.entries()) {
    const concept = normalizeLineConcept(line.concept)
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)
    const lineSubtotal = calculateQuoteLineSubtotal(line)

    if (
      !concept ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      !Number.isFinite(lineSubtotal)
    ) {
      return null
    }

    payloads.push({
      id: createLocalId('QUOTE-LINE'),
      quote_id: quoteId,
      sort_order: index + 1,
      concept,
      quantity: roundMoney(quantity),
      unit: line.unit.trim() || 'servicio',
      unit_price: roundMoney(unitPrice),
      line_subtotal: lineSubtotal,
    })
  }

  return payloads
}
