import { useEffect, useState } from 'react'
import { SearchBar } from './SearchBar'

export interface ListToolbarOption {
  value: string
  label: string
}

export interface ListToolbarFilter {
  key: string
  label: string
  value: string
  options: ListToolbarOption[]
}

export interface ListPreferences {
  searchQuery: string
  sortField: string
  sortDirection: 'asc' | 'desc'
  filters: Record<string, string>
}

interface ListToolbarProps {
  storageKey: string
  searchLabel: string
  searchPlaceholder: string
  resultCount: number
  totalCount: number
  sortOptions: ListToolbarOption[]
  defaultPreferences: ListPreferences
  filters?: ListToolbarFilter[]
  onChange: (preferences: ListPreferences) => void
}

function readPreferences(storageKey: string, fallback: ListPreferences): ListPreferences {
  if (typeof window === 'undefined') return fallback

  try {
    const storedValue = window.localStorage.getItem(storageKey)
    if (!storedValue) return fallback
    const parsedValue = JSON.parse(storedValue) as Partial<ListPreferences>

    return {
      searchQuery: typeof parsedValue.searchQuery === 'string' ? parsedValue.searchQuery : fallback.searchQuery,
      sortField: typeof parsedValue.sortField === 'string' ? parsedValue.sortField : fallback.sortField,
      sortDirection:
        parsedValue.sortDirection === 'asc' || parsedValue.sortDirection === 'desc'
          ? parsedValue.sortDirection
          : fallback.sortDirection,
      filters:
        parsedValue.filters && typeof parsedValue.filters === 'object'
          ? { ...fallback.filters, ...parsedValue.filters }
          : fallback.filters,
    }
  } catch {
    return fallback
  }
}

function hasActivePreferences(preferences: ListPreferences, defaults: ListPreferences): boolean {
  if (preferences.searchQuery.trim()) return true
  if (preferences.sortField !== defaults.sortField) return true
  if (preferences.sortDirection !== defaults.sortDirection) return true
  return Object.entries(preferences.filters).some(([key, value]) => value !== (defaults.filters[key] ?? 'all'))
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4.5 7h15M7.5 12h9M10 17h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M8 6.5v11M8 17.5l-2.5-2.5M8 17.5l2.5-2.5M16 17.5v-11M16 6.5 13.5 9M16 6.5 18.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M7.5 8.5H4.5v-3M5 8.5a7 7 0 1 1-1 7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ListToolbar({
  storageKey,
  searchLabel,
  searchPlaceholder,
  resultCount,
  totalCount,
  sortOptions,
  defaultPreferences,
  filters = [],
  onChange,
}: ListToolbarProps) {
  const [preferences, setPreferences] = useState<ListPreferences>(() => readPreferences(storageKey, defaultPreferences))
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const hasActiveControls = hasActivePreferences(preferences, defaultPreferences)
  const activeFilterCount = Object.entries(preferences.filters).filter(
    ([key, value]) => value !== (defaultPreferences.filters[key] ?? 'all'),
  ).length
  const activeSummaryBits = [
    preferences.searchQuery.trim() ? 'busqueda' : null,
    preferences.sortField !== defaultPreferences.sortField || preferences.sortDirection !== defaultPreferences.sortDirection
      ? 'orden'
      : null,
    activeFilterCount > 0 ? `${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  const sortLabel =
    sortOptions.find((option) => option.value === preferences.sortField)?.label ?? preferences.sortField
  const toolbarState = activeSummaryBits.length > 0
    ? activeSummaryBits.join(' / ')
    : `Orden base: ${sortLabel}`
  const toolbarCaption = hasActiveControls
    ? 'Solo queda visible lo que cambia la lectura de esta lista.'
    : 'Busqueda, orden y filtros en segundo plano hasta que hagan falta.'

  useEffect(() => {
    onChange(preferences)

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences))
    } catch {
      // List preferences are convenient, not business-critical.
    }
  }, [onChange, preferences, storageKey])

  function updatePreferences(update: (current: ListPreferences) => ListPreferences) {
    setPreferences((current) => update(current))
  }

  return (
    <div className="cc-list-toolbar">
      <div className="cc-list-toolbar__overview">
        <div className="cc-list-toolbar__intro">
          <span className="cc-list-toolbar__eyebrow">Vista de lista</span>
          <strong className="cc-list-toolbar__headline">
            {resultCount} visibles de {totalCount}
          </strong>
          <span className="cc-list-toolbar__caption">{toolbarCaption}</span>
        </div>

        <div className="cc-list-toolbar__actions">
          <span className="cc-list-toolbar__state" aria-live="polite">{toolbarState}</span>
          {hasActiveControls ? (
            <button
              type="button"
              className="secondary-button cc-list-toolbar__reset"
              onClick={() => setPreferences(defaultPreferences)}
            >
              <span className="cc-list-toolbar__field-icon" aria-hidden="true"><ResetIcon /></span>
              Limpiar vista
            </button>
          ) : null}
        </div>
      </div>

      <SearchBar
        label={searchLabel}
        value={preferences.searchQuery}
        onChange={(searchQuery) => updatePreferences((current) => ({ ...current, searchQuery }))}
        placeholder={searchPlaceholder}
      />

      <details
        className="cc-list-toolbar__panel cc-collapsible-section"
        open={showAdvancedControls}
        onToggle={(event) => setShowAdvancedControls(event.currentTarget.open)}
      >
        <summary className="cc-list-toolbar__panel-summary cc-collapsible-section__summary">
          <div className="cc-list-toolbar__panel-copy">
            <strong>Ajustar lista</strong>
            <span>
              {activeSummaryBits.length > 0 ? activeSummaryBits.join(' / ') : 'Controles ocultos para leer mejor'}
            </span>
          </div>
          {hasActiveControls ? <span className="cc-list-toolbar__panel-badge">Afinada</span> : <span className="cc-list-toolbar__panel-badge is-muted">Base</span>}
        </summary>

        <div className="cc-list-toolbar__controls" aria-label="Ordenacion y filtros de lista">
          <label className="cc-list-toolbar__field">
            <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><SortIcon /></span> Ordenar por</span>
            <select
              value={preferences.sortField}
              onChange={(event) => updatePreferences((current) => ({ ...current, sortField: event.target.value }))}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="cc-list-toolbar__field">
            <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><SortIcon /></span> Direccion</span>
            <select
              value={preferences.sortDirection}
              onChange={(event) => updatePreferences((current) => ({
                ...current,
                sortDirection: event.target.value === 'asc' ? 'asc' : 'desc',
              }))}
            >
              <option value="desc">Mayor / reciente primero</option>
              <option value="asc">Menor / antiguo primero</option>
            </select>
          </label>

          {filters.map((filter) => (
            <label key={filter.key} className="cc-list-toolbar__field">
              <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><FiltersIcon /></span> {filter.label}</span>
              <select
                value={preferences.filters[filter.key] ?? 'all'}
                onChange={(event) => updatePreferences((current) => ({
                  ...current,
                  filters: {
                    ...current.filters,
                    [filter.key]: event.target.value,
                  },
                }))}
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}

        </div>
      </details>
    </div>
  )
}
