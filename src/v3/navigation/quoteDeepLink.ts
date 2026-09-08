export function readQuoteDeepLink(search: string): string | null {
  const quoteId = new URLSearchParams(search).get('quote')?.trim()
  return quoteId || null
}

export function writeQuoteDeepLink(quoteId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (quoteId) url.searchParams.set('quote', quoteId)
  else url.searchParams.delete('quote')
  if (replace) window.history.replaceState({ quote: quoteId }, '', url)
  else window.history.pushState({ quote: quoteId }, '', url)
}
