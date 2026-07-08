export interface ListSortOption {
  value: string
  label: string
}

export interface ListFilterOption {
  value: string
  label: string
}

export interface ListControlFilter {
  key: string
  label: string
  value: string
  options: ListFilterOption[]
}

export interface ListControlState {
  searchQuery: string
  sortField: string
  sortDirection: 'asc' | 'desc'
  filters: Record<string, string>
}

export interface ListToolbarAction {
  id: string
  label: string
  detail?: string
  badge?: string | null
  active?: boolean
  onClick: () => void
}
