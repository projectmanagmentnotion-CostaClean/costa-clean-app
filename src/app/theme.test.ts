import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getInitialTheme, getStoredTheme, getThemeColor, getThemeFeedback, isAppTheme, setStoredTheme } from './theme'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('theme helpers', () => {
  it('accepts only supported theme names', () => {
    expect(isAppTheme('dark')).toBe(true)
    expect(isAppTheme('light')).toBe(true)
    expect(isAppTheme('system')).toBe(false)
    expect(isAppTheme(null)).toBe(false)
  })

  it('reads and writes the persisted theme safely', () => {
    const store = new Map<string, string>()
    store.set('costaclean-theme', 'light')

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value)
        }),
      },
    })

    expect(getStoredTheme()).toBe('light')
    expect(getInitialTheme()).toBe('light')

    setStoredTheme('dark')
    expect(store.get('costaclean-theme')).toBe('dark')
  })

  it('applies theme metadata without changing behavior', () => {
    const meta = { content: '' }
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: {} as { colorScheme?: string },
    }

    vi.stubGlobal('document', {
      documentElement,
      querySelector: vi.fn(() => meta),
    })

    applyTheme('dark')

    expect(documentElement.dataset.theme).toBe('dark')
    expect(documentElement.style.colorScheme).toBe('dark')
    expect(meta.content).toBe(getThemeColor('dark'))
    expect(getThemeFeedback('light')).toBe('Modo claro activado')
  })
})
