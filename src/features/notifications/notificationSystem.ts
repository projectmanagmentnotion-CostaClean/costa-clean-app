import { getSupabaseClient } from '../../lib/supabase'

export type NotificationCategory = 'collections' | 'operations' | 'administration'
export type NotificationCapability = 'supported' | 'install_required' | 'unsupported'
export type NotificationPermission = 'default' | 'granted' | 'denied'
export type NotificationSubscription = 'active' | 'inactive' | 'unavailable'

export interface NotificationRuntimeState {
  capability: NotificationCapability
  permission: NotificationPermission
  subscription: NotificationSubscription
  installed: boolean
  online: boolean
}

export interface NotificationPreferences {
  master_enabled: boolean
  collections_enabled: boolean
  operations_enabled: boolean
  administration_enabled: boolean
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_COSTA_CLEAN_VAPID_PUBLIC_KEY ?? ''

export const ALLOWED_NOTIFICATION_PATHS = new Set([
  '/?view=invoices&filter=overdue',
  '/?view=expenses&filter=missing_support',
  '/?view=jobs&filter=completed_without_invoice',
  '/?view=quotes',
  '/?view=alerts',
])

export function sanitizeNotificationPath(path: unknown) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/'
  return ALLOWED_NOTIFICATION_PATHS.has(path) ? path : '/'
}

export function readNotificationRuntimeState(): NotificationRuntimeState {
  const supportsNotifications = typeof window !== 'undefined' && 'Notification' in window
  const supportsPush = typeof window !== 'undefined' && 'PushManager' in window
  const supportsServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true

  return {
    capability: supportsNotifications && supportsPush && supportsServiceWorker ? 'supported' : 'unsupported',
    permission: supportsNotifications ? window.Notification.permission : 'denied',
    subscription: 'unavailable',
    installed,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  }
}

export async function registerCostaCleanServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/notification-sw.js', { scope: '/' })
}

export async function enableCostaCleanNotifications() {
  if (!PUBLIC_VAPID_KEY) throw new Error('Las notificaciones no están configuradas para este entorno.')
  const state = readNotificationRuntimeState()
  if (state.capability !== 'supported') throw new Error('Este navegador no admite notificaciones push para Costa Clean.')
  const permission = await window.Notification.requestPermission()
  if (permission !== 'granted') return { permission, subscription: null }
  const registration = await registerCostaCleanServiceWorker()
  if (!registration) throw new Error('No se pudo registrar el service worker de notificaciones.')
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64(PUBLIC_VAPID_KEY),
  })
  const json = subscription.toJSON()
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Tu sesión ha caducado.')
  const { error: saveError } = await client.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    expiration_time: json.expirationTime ? new Date(json.expirationTime).toISOString() : null,
    active: true,
  }, { onConflict: 'endpoint' })
  if (saveError) throw saveError
  return { permission, subscription }
}

function decodeBase64(value: string) {
  const normalized = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
