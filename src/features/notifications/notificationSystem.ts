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

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  master_enabled: true,
  collections_enabled: true,
  operations_enabled: true,
  administration_enabled: true,
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_COSTA_CLEAN_VAPID_PUBLIC_KEY ?? ''

const allowedFilters = {
  invoices: new Set(['overdue']),
  expenses: new Set(['missing_support']),
  jobs: new Set(['completed_without_invoice']),
  quotes: new Set(['accepted_pending_action']),
  alerts: new Set(['all']),
} as const

export function sanitizeNotificationPath(path: unknown) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/'
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.costacleanbcn.com'
  const url = new URL(path, origin)
  if (url.origin !== origin || url.pathname !== '/') return '/'
  const view = url.searchParams.get('view') as keyof typeof allowedFilters | null
  if (!view || !(view in allowedFilters)) return '/'
  const filter = url.searchParams.get('filter')
  const entityId = url.searchParams.get('invoice') ?? url.searchParams.get('job') ?? url.searchParams.get('quote') ?? url.searchParams.get('expense')
  if (filter && !(allowedFilters[view] as ReadonlySet<string>).has(filter)) return '/'
  if (entityId && !/^[A-Za-z0-9_-]{1,80}$/.test(entityId)) return '/'
  return `${url.pathname}${url.search}`
}

export function readNotificationRuntimeState(): NotificationRuntimeState {
  const supportsNotifications = typeof window !== 'undefined' && 'Notification' in window
  const supportsPush = typeof window !== 'undefined' && 'PushManager' in window
  const supportsServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const installed = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches === true || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  return {
    capability: isIos && !installed ? 'install_required' : supportsNotifications && supportsPush && supportsServiceWorker ? 'supported' : 'unsupported',
    permission: supportsNotifications ? window.Notification.permission : 'denied',
    subscription: 'inactive',
    installed,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  }
}

export async function hydrateCostaCleanNotificationState(): Promise<NotificationRuntimeState> {
  const state = readNotificationRuntimeState()
  if (state.capability !== 'supported' || state.permission !== 'granted') return state
  try {
    const registration = await registerCostaCleanServiceWorker()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return { ...state, subscription: 'inactive' }
    const { client } = getSupabaseClient()
    if (!client) return { ...state, subscription: 'inactive' }
    const { data, error } = await client.from('push_subscriptions').select('active').eq('endpoint', subscription.endpoint).maybeSingle()
    return { ...state, subscription: !error && data?.active === true ? 'active' : 'inactive' }
  } catch {
    return { ...state, subscription: 'inactive' }
  }
}

export async function registerCostaCleanServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/notification-sw.js', { scope: '/' })
}

export async function enableCostaCleanNotifications() {
  if (!PUBLIC_VAPID_KEY) throw new Error('Las notificaciones no están configuradas para este entorno.')
  const state = readNotificationRuntimeState()
  if (state.capability === 'install_required') throw new Error('Instala Costa Clean en la pantalla de inicio para activar notificaciones en este dispositivo.')
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

export async function disableCostaCleanNotifications() {
  const registration = await navigator.serviceWorker?.ready
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  if (subscription) {
    const { error: updateError } = await client.from('push_subscriptions').update({ active: false }).eq('endpoint', subscription.endpoint)
    if (updateError) throw updateError
  }
}

export async function loadNotificationPreferences() {
  const { client } = getSupabaseClient()
  if (!client) return DEFAULT_NOTIFICATION_PREFERENCES
  const { data } = await client.from('notification_preferences').select('master_enabled,collections_enabled,operations_enabled,administration_enabled').maybeSingle()
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data ?? {}) } as NotificationPreferences
}

export async function saveNotificationPreferences(preferences: NotificationPreferences) {
  const { client, error } = getSupabaseClient()
  if (!client) throw new Error(error ?? 'No se pudo inicializar Supabase.')
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Tu sesión ha caducado.')
  const { error: saveError } = await client.from('notification_preferences').upsert({ user_id: user.id, ...preferences }, { onConflict: 'user_id' })
  if (saveError) throw saveError
}

function decodeBase64(value: string) {
  const normalized = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
