import { createClient } from 'npm:@supabase/supabase-js@2.99.2'
import webpush from 'npm:web-push@3.6.7'
import { dispatchClaimedReminders } from '../_shared/notificationDispatcher.mjs'

const runtime = globalThis as typeof globalThis & {
  Deno?: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void }
}
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

const env = (name: string) => runtime.Deno?.env.get(name) ?? ''
const BATCH_LIMIT = Math.min(Math.max(Number(env('COSTA_CLEAN_NOTIFICATION_BATCH_LIMIT') || 25), 1), 100)

type Reminder = { id: string; user_id: string }
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function authorized(request: Request) {
  const expected = env('COSTA_CLEAN_NOTIFICATION_DISPATCH_SECRET')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/u, '') ?? ''
  return (Boolean(expected) && token === expected) || (Boolean(env('SUPABASE_SERVICE_ROLE_KEY')) && token === env('SUPABASE_SERVICE_ROLE_KEY'))
}

function requiredEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

async function dispatch() {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
  webpush.setVapidDetails(
    requiredEnv('COSTA_CLEAN_VAPID_SUBJECT'),
    requiredEnv('COSTA_CLEAN_VAPID_PUBLIC_KEY'),
    requiredEnv('COSTA_CLEAN_VAPID_PRIVATE_KEY'),
  )
  const { data: reminders, error: claimError } = await supabase.rpc('claim_notification_reminders', { p_limit: BATCH_LIMIT })
  if (claimError) throw claimError

  const updateReminder = async (id: string, status: string, sentAt: string | null) => {
    const { error } = await supabase.from('notification_reminders').update({ status, sent_at: sentAt, processing_started_at: null }).eq('id', id).eq('status', 'processing')
    if (error) throw error
  }
  const recordAttempt = Object.assign(async ({ reminder, subscription, result, statusCode, errorCode }: { reminder: Reminder; subscription?: Subscription; result: string; statusCode?: number | null; errorCode?: string }) => {
    const { error } = await supabase.from('notification_delivery_attempts').insert({ notification_reminder_id: reminder.id, user_id: reminder.user_id, push_subscription_id: subscription?.id ?? null, result, status_code: statusCode ?? null, error_code: errorCode ?? null })
    if (error) throw error
  }, { deactivate: async (id: string, statusCode: number | null) => {
    const { error } = await supabase.from('push_subscriptions').update({ active: false, last_error_code: 'SUBSCRIPTION_EXPIRED', last_error_at: new Date().toISOString() }).eq('id', id).eq('active', true)
    if (error) throw error
    void statusCode
  }})

  const results = await dispatchClaimedReminders({
    reminders: reminders ?? [],
    loadPreferences: async (userId) => (await supabase.from('notification_preferences').select('master_enabled,collections_enabled,operations_enabled,administration_enabled').eq('user_id', userId).maybeSingle()).data ?? {},
    loadSubscriptions: async (userId) => (await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth,expiration_time').eq('user_id', userId).eq('active', true)).data ?? [],
    loadDelivered: async (reminderId) => (await supabase.from('notification_delivery_attempts').select('push_subscription_id,result').eq('notification_reminder_id', reminderId)).data ?? [],
    sendPush: (subscription, payload) => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600 }),
    recordAttempt,
    updateReminder,
    log: (entry) => console.info(JSON.stringify(entry)),
  })
  return { claimed: reminders?.length ?? 0, results }
}

runtime.Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!authorized(request)) return json(401, { error: 'unauthorized' })
  try { return json(200, await dispatch()) } catch (error) {
    console.error(JSON.stringify({ event: 'notification_dispatch_failed', errorCode: error instanceof Error ? error.message : 'UNKNOWN' }))
    return json(500, { error: 'dispatch_failed' })
  }
})
