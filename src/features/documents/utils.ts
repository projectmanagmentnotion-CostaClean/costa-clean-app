export function sanitizeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildBrandedDocumentTitle(
  kind: 'Factura' | 'Presupuesto',
  reference: string,
  clientName: string,
): string {
  const safeReference = sanitizeFilenamePart(reference)
  const safeClientName = sanitizeFilenamePart(clientName)

  return [kind, safeReference, safeClientName].filter(Boolean).join(' - ')
}

export function buildCustomerDocumentFileStem(
  kind: 'factura' | 'presupuesto',
  reference: string,
): string {
  const safeReference = sanitizeFilenamePart(reference)
    .replace(/\s+/g, '-')
    .toLowerCase()

  return safeReference ? `${kind}-${safeReference}` : kind
}

export async function shareDocumentSummary(
  title: string,
  lines: string[],
  copiedMessage: string,
  unavailableMessage: string,
): Promise<void> {
  const text = [title, ...lines].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      })
      return
    } catch {
      return
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    window.alert(copiedMessage)
  } catch {
    window.alert(unavailableMessage)
  }
}
