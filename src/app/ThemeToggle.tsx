import type { AppTheme } from './theme'

interface ThemeToggleProps {
  theme: AppTheme
  onToggleTheme: () => void
}

export function ThemeToggle({ theme, onToggleTheme }: ThemeToggleProps) {
  const isLight = theme === 'light'
  const nextThemeLabel = isLight ? 'modo oscuro' : 'modo claro'
  const currentThemeLabel = isLight ? 'Claro' : 'Oscuro'

  return (
    <button
      type="button"
      className="cc-theme-toggle"
      onClick={onToggleTheme}
      aria-label={`Cambiar a ${nextThemeLabel}`}
      title={`Cambiar a ${nextThemeLabel}`}
    >
      <span className="cc-theme-toggle__icon" aria-hidden="true">
        {isLight ? (
          <svg viewBox="0 0 24 24" width="17" height="17">
            <path
              d="M12 4.5v-2M12 21.5v-2M4.5 12h-2M21.5 12h-2M6.7 6.7 5.3 5.3M18.7 18.7l-1.4-1.4M17.3 6.7l1.4-1.4M5.3 18.7l1.4-1.4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.9"
            />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17">
            <path
              d="M19.2 14.4A7.2 7.2 0 0 1 9.6 4.8 7.8 7.8 0 1 0 19.2 14.4Z"
              fill="none"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.9"
            />
          </svg>
        )}
      </span>
      <span className="cc-theme-toggle__label">{currentThemeLabel}</span>
    </button>
  )
}
