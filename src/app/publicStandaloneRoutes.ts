const publicQuoteRequestPaths = new Set(['/quote-request', '/presupuesto'])
const publicGymManualQuizPaths = new Set(['/manual-quiz', '/prueba-operativa-gimnasio', '/prueba-manual-gimnasio'])

export function normalizePublicPathname(pathname: string): string {
  const trimmedPath = pathname.trim()

  if (!trimmedPath) return '/'
  if (trimmedPath === '/') return trimmedPath

  return trimmedPath.endsWith('/') ? trimmedPath.slice(0, -1) : trimmedPath
}

export function isPublicQuoteRequestPath(pathname: string): boolean {
  return publicQuoteRequestPaths.has(normalizePublicPathname(pathname))
}

export function isPublicGymManualQuizPath(pathname: string): boolean {
  return publicGymManualQuizPaths.has(normalizePublicPathname(pathname))
}
