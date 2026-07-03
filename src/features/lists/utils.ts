import { matchesSearchQuery, normalizeSearchText } from '../documents/search'
import type { ListControlState, ListSortOption } from './types'

export { normalizeSearchText }

export function applyTextSearch(
  query: string,
  fields: Array<string | number | null | undefined>,
): boolean {
  return matchesSearchQuery(query, fields)
}

export function recentFirstSort(left: string | null | undefined, right: string | null | undefined): number {
  return new Date(right ? (right.includes('T') ? right : `${right}T00:00:00`) : 0).getTime() -
    new Date(left ? (left.includes('T') ? left : `${left}T00:00:00`) : 0).getTime()
}

export function applySortOption<T>(
  items: T[],
  state: Pick<ListControlState, 'sortDirection' | 'sortField'>,
  comparators: Record<string, (left: T, right: T) => number>,
  fallbackField?: string,
): T[] {
  const comparator = comparators[state.sortField] ?? (fallbackField ? comparators[fallbackField] : undefined)
  if (!comparatorExists(comparator)) {
    return items
  }

  return [...items].sort((left, right) => {
    const comparison = comparator(left, right)
    return state.sortDirection === 'asc' ? comparison : -comparison
  })
}

export function buildDefaultListControlState(
  sortField: string,
  sortDirection: ListControlState['sortDirection'] = 'desc',
  filters: Record<string, string> = {},
): ListControlState {
  return {
    searchQuery: '',
    sortField,
    sortDirection,
    filters,
  }
}

export function buildSortLabel(options: ListSortOption[], field: string): string {
  return options.find((option) => option.value === field)?.label ?? field
}

function comparatorExists<T>(comparator: ((left: T, right: T) => number) | undefined): comparator is (left: T, right: T) => number {
  return typeof comparator === 'function'
}
