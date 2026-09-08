export function readJobDeepLink(search: string): string | null {
  const id = new URLSearchParams(search).get('job')?.trim()
  return id || null
}

export function writeJobDeepLink(jobId: string | null, replace = false): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (jobId) url.searchParams.set('job', jobId)
  else {
    url.searchParams.delete('job')
    url.searchParams.delete('jobTab')
  }
  if (replace) window.history.replaceState({ job: jobId }, '', url)
  else window.history.pushState({ job: jobId }, '', url)
}
