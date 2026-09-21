export function readLeadDeepLink(search: string): string | null {
  const leadId = new URLSearchParams(search).get('lead')?.trim()
  return leadId || null
}

export function writeLeadDeepLink(leadId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (leadId) url.searchParams.set('lead', leadId)
  else url.searchParams.delete('lead')
  if (replace) window.history.replaceState({ lead: leadId }, '', url)
  else window.history.pushState({ lead: leadId }, '', url)
}
