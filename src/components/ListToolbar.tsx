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
      sortDirection: parsedValue.sortDirection === 'asc' || parsedValue.sortDirection === 'desc'
        ? parsedValue.sortDirection
        : fallback.sortDirection,
      filters: parsedValue.filters && typeof parsedValue.filters === 'object'
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
  const hasActiveControls = hasActivePreferences(preferences, defaultPreferences)

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
      <SearchBar
        label={searchLabel}
        value={preferences.searchQuery}
        onChange={(searchQuery) => updatePreferences((current) => ({ ...current, searchQuery }))}
        placeholder={searchPlaceholder}
        resultCount={resultCount}
        totalCount={totalCount}
      />

      <div className="cc-list-toolbar__controls" aria-label="Ordenación y filtros de lista">
        <label className="cc-list-toolbar__field">
          <span><span className="cc-list-toolbar__field-icon" aria-hidden="true">↕</span> Ordenar por</span>
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
          <span><span className="cc-list-toolbar__field-icon" aria-hidden="true">⇅</span> Dirección</span>
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
            <span><span className="cc-list-toolbar__field-icon" aria-hidden="true">⌁</span> {filter.label}</span>
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

        <button
          type="button"
          className="secondary-button cc-list-toolbar__reset"
          onClick={() => setPreferences(defaultPreferences)}
          disabled={!hasActiveControls}
        >
          <span aria-hidden="true">×</span>
          Limpiar filtros
        </button>
      </div>

      {hasActiveControls ? (
        <div className="cc-list-toolbar__summary" aria-live="polite">
          Mostrando {resultCount} de {totalCount} registros con preferencias aplicadas.
        </div>
      ) : null}
    </div>
  )
}
