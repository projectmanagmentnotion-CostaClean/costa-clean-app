function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) return '/'
  const url = new URL(value, self.location.origin)
  if (url.origin !== self.location.origin || url.pathname !== '/') return '/'
  const viewRules = {
    invoices: new Set(['overdue']),
    expenses: new Set(['missing_support']),
    jobs: new Set(['completed_without_invoice']),
    quotes: new Set(['accepted_pending_action']),
    alerts: new Set(['all']),
  }
  const view = url.searchParams.get('view')
  const filter = url.searchParams.get('filter')
  const entity = url.searchParams.get('invoice') ?? url.searchParams.get('job') ?? url.searchParams.get('quote') ?? url.searchParams.get('expense')
  if (!view || !viewRules[view] || (filter && !viewRules[view].has(filter)) || (entity && !/^[A-Za-z0-9_-]{1,80}$/.test(entity))) return '/'
  return `${url.pathname}${url.search}`
}

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Costa Clean'
  const body = typeof payload.body === 'string' ? payload.body : ''
  const destinationPath = safePath(payload.destination_path ?? payload.destinationPath)
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof payload.tag === 'string' ? payload.tag : 'costaclean-notification',
    renotify: false,
    icon: '/branding/costaclean-icon-192.png',
    badge: '/branding/costaclean-icon-192.png',
    data: { destinationPath },
  }))
})

self.addEventListener('notificationclick', (event) => {
  const destinationPath = safePath(event.notification?.data?.destinationPath)
  event.notification.close()
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(new URL(destinationPath, self.location.origin).href)
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(new URL(destinationPath, self.location.origin).href)
  })())
})
