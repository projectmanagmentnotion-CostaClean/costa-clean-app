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
