import { describe, expect, it, vi } from 'vitest'
import {
  clearVitePreloadRecovery,
  installVitePreloadRecovery,
  vitePreloadRecoveryStorageKey,
} from './vitePreloadRecovery'

function createWindowMock() {
  const listeners = new Map<string, EventListener>()
  const storage = new Map<string, string>()
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    sessionStorage: {
      get length() {
        return storage.size
      },
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
    } as Storage,
    location: { reload: vi.fn() } as unknown as Location,
    dispatchPreloadError() {
      const event = { preventDefault: vi.fn() } as unknown as Event
      listeners.get('vite:preloadError')?.(event)
      return event as Event & { preventDefault: ReturnType<typeof vi.fn> }
    },
  }
}

describe('vite preload recovery', () => {
  it('reloads once after the first preload failure and never loops', () => {
    const windowMock = createWindowMock()
    installVitePreloadRecovery(windowMock)

    const firstEvent = windowMock.dispatchPreloadError()
    const secondEvent = windowMock.dispatchPreloadError()

    expect(firstEvent.preventDefault).toHaveBeenCalledOnce()
    expect(secondEvent.preventDefault).toHaveBeenCalledOnce()
    expect(windowMock.location.reload).toHaveBeenCalledOnce()
    expect(windowMock.sessionStorage.getItem(vitePreloadRecoveryStorageKey)).toBe('attempted')
  })

  it('clears the marker after a healthy startup', () => {
    const windowMock = createWindowMock()
    windowMock.sessionStorage.setItem(vitePreloadRecoveryStorageKey, 'attempted')

    clearVitePreloadRecovery(windowMock)

    expect(windowMock.sessionStorage.getItem(vitePreloadRecoveryStorageKey)).toBeNull()
  })
})
