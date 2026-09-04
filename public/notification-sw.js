const ALLOWED_PATHS = new Set([
  '/?view=invoices&filter=overdue',
  '/?view=expenses&filter=missing_support',
  '/?view=jobs&filter=completed_without_invoice',
  '/?view=quotes',
  '/?view=alerts',
])

function safePath(value) {
  return typeof value === 'string' && ALLOWED_PATHS.has(value) ? value : '/'
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
