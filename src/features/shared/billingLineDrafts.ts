export interface BillingLineFormState {
  local_id: string
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

export interface BillingLinePayload {
  id: string
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

export function createBlankBillingLine(overrides: Partial<BillingLineFormState> = {}): BillingLineFormState {
  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: '',
    quantity: '1.00',
    unit: 'servicio',
    unit_price: '0.00',
    ...overrides,
  }
}

export function calculateBillingLineSubtotal(line: BillingLineFormState): number {
  const quantity = parseDecimalInput(line.quantity)
  const unitPrice = parseDecimalInput(line.unit_price)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN
  return roundMoney(quantity * unitPrice)
}

export function formatBillingLineSubtotalInput(line: BillingLineFormState): string {
  const lineSubtotal = calculateBillingLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? '' : formatMoneyInput(lineSubtotal)
}

export function calculateBillingSubtotal(lines: BillingLineFormState[]): number {
  return roundMoney(lines.reduce((sum, line) => {
    const lineSubtotal = calculateBillingLineSubtotal(line)
    return Number.isNaN(lineSubtotal) ? sum : sum + lineSubtotal
  }, 0))
}

export function buildBillingLinePayloads(
  lines: BillingLineFormState[],
  normalizeConcept: (concept: string) => string,
): BillingLinePayload[] | null {
  const payloads: BillingLinePayload[] = []

  for (const [index, line] of lines.entries()) {
    const concept = normalizeConcept(line.concept)
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)
    const lineSubtotal = calculateBillingLineSubtotal(line)

    if (!concept || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || !Number.isFinite(lineSubtotal)) {
      return null
    }

    payloads.push({
      id: createLocalId('BILLING-LINE'),
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
