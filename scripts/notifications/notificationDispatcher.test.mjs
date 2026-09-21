import { describe, expect, it, vi } from 'vitest'
import { dispatchClaimedReminders, preferencesAllow, sanitizeDestinationPath } from '../../supabase/functions/_shared/notificationDispatcher.mjs'

const reminder = (overrides = {}) => ({ id: 'r1', user_id: 'u1', category: 'operations', title: 'Ready', body: 'Open task', dedupe_key: 'job-1', destination_path: '/?view=jobs&filter=completed_without_invoice', ...overrides })

function harness({ reminders = [reminder()], preferences = {}, subscriptions = [{ id: 's1', endpoint: 'https://push.invalid/1', p256dh: 'p', auth: 'a' }], delivered = [], sendPush = vi.fn().mockResolvedValue(undefined) } = {}) {
  const attempts = []
  const updates = []
  return {
    attempts,
    updates,
    sendPush,
    run: () => dispatchClaimedReminders({ reminders, loadPreferences: async () => preferences, loadSubscriptions: async () => subscriptions, loadDelivered: async () => delivered, sendPush, recordAttempt: async (attempt) => attempts.push(attempt), updateReminder: async (...update) => updates.push(update), now: () => '2026-09-06T00:00:00.000Z' }),
  }
}

describe('notification dispatcher contract', () => {
  it('handles an empty claim without provider work', async () => { const h = harness({ reminders: [] }); expect(await h.run()).toEqual([]); expect(h.sendPush).not.toHaveBeenCalled() })
  it('sends a claimed reminder once and marks it sent', async () => { const h = harness(); await h.run(); expect(h.sendPush).toHaveBeenCalledTimes(1); expect(h.attempts[0].result).toBe('sent'); expect(h.updates[0][1]).toBe('sent') })
  it('prevents a duplicate delivery for an already sent subscription', async () => { const h = harness({ delivered: [{ push_subscription_id: 's1', result: 'sent' }] }); await h.run(); expect(h.sendPush).not.toHaveBeenCalled(); expect(h.updates[0][1]).toBe('sent') })
  it('honors master and category preferences', async () => { expect(preferencesAllow({ master_enabled: false }, 'operations')).toBe(false); expect(preferencesAllow({ master_enabled: true, operations_enabled: false }, 'operations')).toBe(false); const h = harness({ preferences: { master_enabled: false } }); await h.run(); expect(h.attempts[0].errorCode).toBe('PREFERENCE_DISABLED') })
  it('marks no active subscriptions as processed without sending', async () => { const h = harness({ subscriptions: [] }); await h.run(); expect(h.sendPush).not.toHaveBeenCalled(); expect(h.updates[0][1]).toBe('sent') })
  it('deactivates expired endpoints and does not retry them', async () => { const sendPush = vi.fn().mockRejectedValue({ statusCode: 410 }); const h = harness({ sendPush }); h.attempts.deactivate = vi.fn(); const original = h.run; h.run = () => dispatchClaimedReminders({ reminders: [reminder()], loadPreferences: async () => ({}), loadSubscriptions: async () => [{ id: 's1' }], loadDelivered: async () => [], sendPush, recordAttempt: Object.assign(async (a) => h.attempts.push(a), { deactivate: h.attempts.deactivate }), updateReminder: async (...u) => h.updates.push(u) }); await h.run(); expect(h.attempts[0].result).toBe('terminal_failure'); expect(h.attempts.deactivate).toHaveBeenCalledWith('s1', 410); expect(h.updates[0][1]).toBe('sent') })
  it('keeps transient provider failures retryable', async () => { const h = harness({ sendPush: vi.fn().mockRejectedValue({ statusCode: 503 }) }); await h.run(); expect(h.attempts[0].result).toBe('failed'); expect(h.updates[0][1]).toBe('ready') })
  it('sanitizes unsafe or malformed deep links', () => { expect(sanitizeDestinationPath('https://evil.invalid')).toBe('/'); expect(sanitizeDestinationPath('/?view=jobs&filter=bad')).toBe('/'); expect(sanitizeDestinationPath('/?view=jobs&filter=completed_without_invoice&job=abc_123')).toContain('job=abc_123') })
  it('supports multiple devices independently', async () => { const h = harness({ subscriptions: [{ id: 's1' }, { id: 's2' }] }); await h.run(); expect(h.sendPush).toHaveBeenCalledTimes(2); expect(h.attempts).toHaveLength(2) })
})
