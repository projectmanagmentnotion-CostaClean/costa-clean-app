import { describe, expect, it } from 'vitest'
import { handleRealtimeSubscriptionStatus } from './realtimeSubscription'
import useAppDataSource from './useAppData.ts?raw'

function createRefreshHarness() {
  const executed: string[][] = []
  const queued: string[][] = []
  let refreshInFlight = false

  return {
    executed,
    queued,
    setRefreshInFlight(value: boolean) {
      refreshInFlight = value
    },
    refreshActiveView() {
      const domains = ['clients', 'jobs']
      if (refreshInFlight) {
        queued.push(domains)
        return
      }

      executed.push(domains)
    },
  }
}

describe('realtime subscription startup catch-up', () => {
  it('queues the active-view refresh when the initial refresh is still in flight', () => {
    const harness = createRefreshHarness()
    harness.setRefreshInFlight(true)

    expect(handleRealtimeSubscriptionStatus('SUBSCRIBED', harness.refreshActiveView)).toBe(true)
    expect(harness.executed).toEqual([])
    expect(harness.queued).toEqual([['clients', 'jobs']])
  })

  it('executes the active-view refresh when no refresh is in flight', () => {
    const harness = createRefreshHarness()

    expect(handleRealtimeSubscriptionStatus('SUBSCRIBED', harness.refreshActiveView)).toBe(true)
    expect(harness.executed).toEqual([['clients', 'jobs']])
  })

  it('does not treat channel failures as successful catch-up', () => {
    const harness = createRefreshHarness()

    for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      expect(handleRealtimeSubscriptionStatus(status, harness.refreshActiveView)).toBe(false)
    }

    expect(harness.executed).toEqual([])
    expect(harness.queued).toEqual([])
  })

  it('runs catch-up again after a reconnect reaches SUBSCRIBED', () => {
    const harness = createRefreshHarness()

    handleRealtimeSubscriptionStatus('SUBSCRIBED', harness.refreshActiveView)
    handleRealtimeSubscriptionStatus('CHANNEL_ERROR', harness.refreshActiveView)
    handleRealtimeSubscriptionStatus('SUBSCRIBED', harness.refreshActiveView)

    expect(harness.executed).toHaveLength(2)
  })

  it('keeps cleanup and debounce ownership in the hook without introducing polling', () => {
    expect(useAppDataSource).toContain('window.clearTimeout(pendingRealtimeRefreshRef.current)')
    expect(useAppDataSource).toContain('client.removeChannel(channel)')
    expect(useAppDataSource).not.toContain('setInterval(')
  })
})
