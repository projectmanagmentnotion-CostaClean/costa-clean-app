export type NotificationDeepLink = {
  view: 'invoices' | 'expenses' | 'jobs' | 'quotes' | 'alerts'
  filter: 'unpaid_older_7d' | 'missing_receipt' | 'completed_without_invoice' | 'accepted_without_job' | 'all'
  rawFilter: string
  entityType: 'invoice' | 'expense' | 'job' | 'quote' | null
  entityId: string | null
  destinationPath: string
}

const FILTERS = {
  invoices: { overdue: 'unpaid_older_7d' },
  expenses: { missing_support: 'missing_receipt' },
  jobs: { completed_without_invoice: 'completed_without_invoice' },
  quotes: { accepted_pending_action: 'accepted_without_job' },
  alerts: { all: 'all' },
} as const

const ENTITY_PARAMS = {
  invoices: ['invoice', 'invoice'] as const,
  expenses: ['expense', 'expense'] as const,
  jobs: ['job', 'job'] as const,
  quotes: ['quote', 'quote'] as const,
} as const

function isSafeEntityId(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{1,255}$/.test(value))
}

export function parseNotificationDestination(value: unknown, origin = 'https://app.costacleanbcn.com'): NotificationDeepLink | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) return null

  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return null
  }

  if (url.origin !== origin || url.pathname !== '/') return null
  const view = url.searchParams.get('view') as keyof typeof FILTERS | null
  const rawFilter = url.searchParams.get('filter')
  const canonicalFilter = view && rawFilter ? FILTERS[view]?.[rawFilter as never] : undefined
  if (!view || !rawFilter || !canonicalFilter) return null

  const entityConfig = ENTITY_PARAMS[view as keyof typeof ENTITY_PARAMS]
  const entityId = entityConfig ? url.searchParams.get(entityConfig[0]) : null
  if (entityId !== null && !isSafeEntityId(entityId)) return null

  const unexpectedEntity = Object.values(ENTITY_PARAMS)
    .filter(([, entityType]) => entityType !== entityConfig?.[1])
    .some(([param]) => url.searchParams.has(param))
  if (unexpectedEntity) return null

  return {
    view,
    filter: canonicalFilter,
    rawFilter,
    entityType: entityConfig?.[1] ?? null,
    entityId,
    destinationPath: `${url.pathname}${url.search}`,
  } as NotificationDeepLink
}

export function notificationDeepLinkFilter(link: NotificationDeepLink) {
  return link.filter
}
