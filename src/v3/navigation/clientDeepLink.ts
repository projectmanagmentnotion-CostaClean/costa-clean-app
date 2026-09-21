export function readClientDeepLink(search: string): string | null {
  const clientId = new URLSearchParams(search).get('client')?.trim()
  return clientId || null
}

export function writeClientDeepLink(clientId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (clientId) url.searchParams.set('client', clientId)
  else url.searchParams.delete('client')
  if (replace) window.history.replaceState({ client: clientId }, '', url)
  else window.history.pushState({ client: clientId }, '', url)
}
