const CATEGORY_KEYS = Object.freeze({
  collections: 'collections_enabled',
  operations: 'operations_enabled',
  administration: 'administration_enabled',
})

const SAFE_FILTERS = Object.freeze({
  invoices: new Set(['overdue']),
  expenses: new Set(['missing_support']),
  jobs: new Set(['completed_without_invoice']),
  quotes: new Set(['accepted_pending_action']),
  alerts: new Set(['all']),
})

export function sanitizeDestinationPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) return '/'
  let url
  try { url = new URL(value, 'https://app.costacleanbcn.com') } catch { return '/' }
  if (url.origin !== 'https://app.costacleanbcn.com' || url.pathname !== '/') return '/'
  const view = url.searchParams.get('view')
  const filter = url.searchParams.get('filter')
  const entity = url.searchParams.get('invoice') ?? url.searchParams.get('job') ?? url.searchParams.get('quote') ?? url.searchParams.get('expense')
  if (!view || !SAFE_FILTERS[view] || (filter && !SAFE_FILTERS[view].has(filter)) || (entity && !/^[A-Za-z0-9_-]{1,80}$/.test(entity))) return '/'
  return `${url.pathname}${url.search}`
}
export function preferencesAllow(preferences, category) {
  if (preferences?.master_enabled === false) return false
  const key = CATEGORY_KEYS[category]
  return Boolean(key && preferences?.[key] !== false)
}

function isExpiredSubscriptionError(error) {
  return error?.statusCode === 404 || error?.statusCode === 410 || error?.status === 404 || error?.status === 410
}

export async function dispatchClaimedReminders({
  reminders,
  loadPreferences,
  loadSubscriptions,
  loadDelivered,
  sendPush,
  recordAttempt,
  updateReminder,
  now = () => new Date().toISOString(),
  log = () => {},
}) {
  const results = []
  for (const reminder of reminders) {
    const preferences = await loadPreferences(reminder.user_id)
    if (!preferencesAllow(preferences, reminder.category)) {
      await recordAttempt({ reminder, result: 'ignored', errorCode: 'PREFERENCE_DISABLED' })
      await updateReminder(reminder.id, 'sent', now())
      results.push({ reminderId: reminder.id, state: 'sent', delivered: 0, ignored: 1 })
      continue
    }

    const subscriptions = await loadSubscriptions(reminder.user_id)
    const delivered = await loadDelivered(reminder.id)
    const deliveredIds = new Set(delivered.filter((attempt) => ['sent', 'ignored'].includes(attempt.result)).map((attempt) => attempt.push_subscription_id).filter(Boolean))
    const path = sanitizeDestinationPath(reminder.destination_path)
    const payload = JSON.stringify({
      title: String(reminder.title).slice(0, 120),
      body: String(reminder.body).slice(0, 240),
      destination_path: path,
      tag: `costaclean-${reminder.dedupe_key}`.slice(0, 120),
    })
    let deliveredCount = 0
    let ignoredCount = 0
    let retryableFailure = false

    for (const subscription of subscriptions) {
      if (deliveredIds.has(subscription.id)) continue
      try {
        await sendPush(subscription, payload)
        await recordAttempt({ reminder, subscription, result: 'sent', statusCode: 201 })
        deliveredCount += 1
      } catch (error) {
        const statusCode = error?.statusCode ?? error?.status ?? null
        if (isExpiredSubscriptionError(error)) {
          await recordAttempt({ reminder, subscription, result: 'terminal_failure', statusCode, errorCode: 'SUBSCRIPTION_EXPIRED' })
          await recordAttempt.deactivate?.(subscription.id, statusCode)
          ignoredCount += 1
        } else {
          retryableFailure = true
          await recordAttempt({ reminder, subscription, result: 'failed', statusCode, errorCode: 'PUSH_PROVIDER_FAILURE' })
        }
      }
    }

    const state = retryableFailure ? 'ready' : 'sent'
    await updateReminder(reminder.id, state, state === 'sent' ? now() : null)
    log({ event: 'notification_dispatch', reminderId: reminder.id, state, delivered: deliveredCount, ignored: ignoredCount, retryableFailure })
    results.push({ reminderId: reminder.id, state, delivered: deliveredCount, ignored: ignoredCount })
  }
  return results
}
