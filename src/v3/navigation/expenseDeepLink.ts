export function readExpenseDeepLink(search: string): string | null {
  const expenseId = new URLSearchParams(search).get('expense')?.trim()
  return expenseId || null
}

export function writeExpenseDeepLink(expenseId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (expenseId) url.searchParams.set('expense', expenseId)
  else url.searchParams.delete('expense')
  if (replace) window.history.replaceState({ expense: expenseId }, '', url)
  else window.history.pushState({ expense: expenseId }, '', url)
}
