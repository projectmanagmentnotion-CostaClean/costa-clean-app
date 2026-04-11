import type { ListPreferences } from '../../components/ListToolbar'

export function compareText(left: string | null | undefined, right: string | null | undefined): number {
  return (left ?? '').localeCompare(right ?? '', 'es', { numeric: true, sensitivity: 'base' })
}

export function compareNumber(left: number | null | undefined, right: number | null | undefined): number {
  return Number(left ?? 0) - Number(right ?? 0)
}

export function compareDate(left: string | null | undefined, right: string | null | undefined): number {
  return new Date(left ? (left.includes('T') ? left : `${left}T00:00:00`) : 0).getTime() -
    new Date(right ? (right.includes('T') ? right : `${right}T00:00:00`) : 0).getTime()
}

export function applySortDirection(value: number, direction: ListPreferences['sortDirection']): number {
  return direction === 'asc' ? value : -value
}

export function createDefaultPreferences(
  sortField: string,
  sortDirection: ListPreferences['sortDirection'] = 'desc',
  filters: Record<string, string> = {},
): ListPreferences {
  return {
    searchQuery: '',
    sortField,
    sortDirection,
    filters,
  }
}
