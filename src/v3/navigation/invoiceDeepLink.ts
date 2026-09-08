export function readInvoiceDeepLink(search: string): string | null {
  const invoiceId = new URLSearchParams(search).get('invoice')?.trim()
  return invoiceId || null
}

export function readInvoiceFilterDeepLink(search: string): 'pending' | 'unpaid_older_7d' | null {
  const filter = new URLSearchParams(search).get('filter')
  if (filter === 'overdue') return 'unpaid_older_7d'
  if (filter === 'pending') return 'pending'
  return null
}

export function writeInvoiceDeepLink(invoiceId: string | null, replace = false): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (invoiceId) url.searchParams.set('invoice', invoiceId)
  else url.searchParams.delete('invoice')

  if (replace) window.history.replaceState({ invoice: invoiceId }, '', url)
  else window.history.pushState({ invoice: invoiceId }, '', url)
}
