const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const AUTH_PATHS = new Set(['/auth/v1/token', '/auth/v1/user'])

export const QA_SUPABASE_HOST = 'kpvvydthlxupjjqqdpxy.supabase.co'
export const PRODUCTION_SUPABASE_HOST = 'wfxnwfcdjainpojhbdri.supabase.co'

export function sanitizeRequestUrl(rawUrl) {
  const url = new URL(rawUrl)
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    pathname: url.pathname,
  }
}

export function classifyRequest({ method, url }) {
  const sanitized = sanitizeRequestUrl(url)
  const normalizedMethod = String(method ?? 'GET').toUpperCase()
  const isSupabase = sanitized.hostname.endsWith('.supabase.co')
  const environment = sanitized.hostname === QA_SUPABASE_HOST
    ? 'QA_SUPABASE'
    : sanitized.hostname === PRODUCTION_SUPABASE_HOST
      ? 'PRODUCTION_SUPABASE'
      : isSupabase
        ? 'UNKNOWN_SUPABASE'
        : sanitized.hostname === '127.0.0.1' || sanitized.hostname === 'localhost'
          ? 'LOCAL_PREVIEW'
          : 'OTHER'

  let mutation = 'READ'
  if (!READ_METHODS.has(normalizedMethod)) {
    mutation = AUTH_PATHS.has(sanitized.pathname) || sanitized.pathname.startsWith('/auth/v1/')
      ? 'AUTH_SESSION'
      : 'UNKNOWN_MUTATION'
  }

  return { ...sanitized, method: normalizedMethod, environment, mutation }
}

export function createNetworkLedger() {
  return {
    entries: [],
    failedRequests: [],
    pageErrors: [],
    consoleErrors: [],
  }
}

export function recordRequest(ledger, request) {
  const entry = classifyRequest({ method: request.method(), url: request.url() })
  ledger.entries.push({ order: ledger.entries.length + 1, ...entry, resourceType: request.resourceType() })
  return entry
}

export function recordResponse(ledger, response) {
  const sanitized = sanitizeRequestUrl(response.url())
  const matching = [...ledger.entries].reverse().find((candidate) => candidate.hostname === sanitized.hostname && candidate.pathname === sanitized.pathname && candidate.status === undefined)
  if (matching) matching.status = response.status()
  return matching ?? null
}

export function recordRequestFailed(ledger, request) {
  const item = classifyRequest({ method: request.method(), url: request.url() })
  ledger.failedRequests.push(item)
}

export function recordPageError(ledger, error) {
  ledger.pageErrors.push(String(error?.message ?? error).slice(0, 500))
}

export function recordConsoleError(ledger, message) {
  ledger.consoleErrors.push(String(message).slice(0, 500))
}

export function summarizeNetworkLedger(ledger) {
  const entries = ledger.entries
  const count = (predicate) => entries.filter(predicate).length
  return {
    totalRequests: entries.length,
    qaSupabaseRequests: count((entry) => entry.environment === 'QA_SUPABASE'),
    productionSupabaseRequests: count((entry) => entry.environment === 'PRODUCTION_SUPABASE'),
    unknownSupabaseRequests: count((entry) => entry.environment === 'UNKNOWN_SUPABASE'),
    qaBusinessWrites: count((entry) => entry.environment === 'QA_SUPABASE' && entry.mutation === 'BUSINESS_WRITE'),
    productionBusinessWrites: count((entry) => entry.environment === 'PRODUCTION_SUPABASE' && entry.mutation === 'BUSINESS_WRITE'),
    unknownMutations: count((entry) => entry.mutation === 'UNKNOWN_MUTATION'),
    failedRequests: ledger.failedRequests.length,
    pageErrors: ledger.pageErrors.length,
    consoleErrors: ledger.consoleErrors.length,
  }
}

export function classifyBusinessWrite(entry) {
  if (entry.mutation === 'UNKNOWN_MUTATION' && entry.environment !== 'OTHER') return 'BUSINESS_WRITE'
  return entry.mutation
}

export function getExactViewportMetrics(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    devicePixelRatio: window.devicePixelRatio,
  }))
}
