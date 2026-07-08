import { useEffect, useState } from 'react'
import { DSListControlBar } from '../design-system/components/DSListControlBar'
import type {
  ListControlFilter as ListToolbarFilter,
  ListControlState as ListPreferences,
  ListSortOption as ListToolbarOption,
  ListToolbarAction,
} from '../features/lists/types'

interface ListToolbarProps {
  storageKey: string
  searchLabel: string
  searchPlaceholder: string
  resultCount: number
  totalCount: number
  sortOptions: ListToolbarOption[]
  defaultPreferences: ListPreferences
  filters?: ListToolbarFilter[]
  toolbarActions?: ListToolbarAction[]
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

export function ListToolbar({
  storageKey,
  searchLabel,
  searchPlaceholder,
  resultCount,
  totalCount,
  sortOptions,
  defaultPreferences,
  filters = [],
  toolbarActions = [],
  onChange,
}: ListToolbarProps) {
  const [preferences, setPreferences] = useState<ListPreferences>(() => readPreferences(storageKey, defaultPreferences))

  useEffect(() => {
    onChange(preferences)

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences))
    } catch {
      // List preferences are convenient, not business-critical.
    }
  }, [onChange, preferences, storageKey])

  return (
    <DSListControlBar
      searchLabel={searchLabel}
      searchPlaceholder={searchPlaceholder}
      resultCount={resultCount}
      totalCount={totalCount}
      sortOptions={sortOptions}
      state={preferences}
      defaultState={defaultPreferences}
      filters={filters}
      toolbarActions={toolbarActions}
      onChange={setPreferences}
    />
  )
}

export type { ListPreferences, ListToolbarAction, ListToolbarFilter, ListToolbarOption }
