import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'useAppData.ts'), 'utf8')

describe('N1 refresh architecture source contract', () => {
  it('keeps focus and visibility refresh handlers on the canonical foreground path', () => {
    expect(source).toContain("window.addEventListener('focus', requestForegroundRefresh)")
    expect(source).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)")
    expect(source).toContain('requestForegroundRefresh()')
    expect(source).toContain('document.visibilityState === \'visible\'')
  })

  it('keeps reconnect handling on canonical refresh and does not introduce a parallel path', () => {
    expect(source).toContain("window.addEventListener('online', handleOnline)")
    expect(source).toContain('void refreshDomains(getDomainsForView(currentView))')
    expect(source).toContain("window.addEventListener('offline', handleOffline)")
  })

  it('keeps visible polling gated by visibility at the certified interval', () => {
    expect(source).toContain('setInterval')
    expect(source).toContain('60_000')
    expect(source).toContain("document.visibilityState === 'visible'")
    expect(source).toContain('clearInterval')
  })

  it('keeps Realtime invalidation and subscription cleanup canonical', () => {
    expect(source).toContain("client.channel('costaclean-app-sync')")
    expect(source).toContain('.on(')
    expect(source).toContain('runScopedRefresh(scopeToRefresh)')
    expect(source).toContain('client.removeChannel(channel)')
  })
})
