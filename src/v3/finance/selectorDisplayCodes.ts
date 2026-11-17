const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu

function visibleCode(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized && !UUID_PATTERN.test(normalized) ? normalized : null
}

export function relatedDisplayCode(value: string | null | undefined, fallback: string): string {
  return visibleCode(value) ?? fallback
}

export function invoiceDisplayCode(
  displayCode: string | null | undefined,
  invoiceNumber: string | null | undefined,
): string {
  return visibleCode(displayCode) ?? visibleCode(invoiceNumber) ?? 'Factura sin referencia'
}
