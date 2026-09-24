export type RealtimeSubscriptionStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED'
  | (string & {})

/**
 * Runs the startup/reconnect catch-up only after Supabase confirms the channel
 * is subscribed. The callback is intentionally delegated to the existing
 * refresh queue owned by useAppData.
 */
export function handleRealtimeSubscriptionStatus(
  status: RealtimeSubscriptionStatus,
  onSubscribed: () => void,
): boolean {
  if (status !== 'SUBSCRIBED') return false

  onSubscribed()
  return true
}
