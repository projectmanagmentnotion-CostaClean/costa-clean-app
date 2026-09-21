export function readPaymentDeepLink(search: string): string | null {
  const paymentId = new URLSearchParams(search).get('payment')?.trim()
  return paymentId || null
}

export function writePaymentDeepLink(paymentId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (paymentId) url.searchParams.set('payment', paymentId)
  else url.searchParams.delete('payment')
  if (replace) window.history.replaceState({ payment: paymentId }, '', url)
  else window.history.pushState({ payment: paymentId }, '', url)
}
