export type AppTheme = 'dark' | 'light'

const themeStorageKey = 'costaclean-theme'
const supportedThemes = new Set<AppTheme>(['dark', 'light'])

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && supportedThemes.has(value as AppTheme)
}

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') return null

  try {
    const storedValue = window.localStorage.getItem(themeStorageKey)
    return isAppTheme(storedValue) ? storedValue : null
  } catch {
    return null
  }
}

export function getInitialTheme(): AppTheme {
  return getStoredTheme() ?? 'dark'
}

export function setStoredTheme(theme: AppTheme) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(themeStorageKey, theme)
  } catch {
    // Theme persistence is non-critical. The active theme is still applied in memory.
  }
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function getThemeFeedback(theme: AppTheme): string {
  return theme === 'light' ? 'Modo claro activado' : 'Modo oscuro activado'
}
