import { useMemo, useState } from 'react'

export const V3_DEFAULT_LIST_PAGE_SIZE = 25

export interface V3ListWindow<T> {
  pageItems: T[]
  page: number
  pageCount: number
  rangeStart: number
  rangeEnd: number
  totalCount: number
  setPage: (page: number) => void
}

export function buildV3ListWindow<T>(items: readonly T[], page: number, pageSize = V3_DEFAULT_LIST_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize))
  const safePage = Math.max(1, Math.min(pageCount, Math.floor(page) || 1))
  const startIndex = (safePage - 1) * safePageSize
  return {
    pageItems: items.slice(startIndex, startIndex + safePageSize),
    page: safePage,
    pageCount,
    rangeStart: items.length === 0 ? 0 : startIndex + 1,
    rangeEnd: items.length === 0 ? 0 : Math.min(startIndex + safePageSize, items.length),
    totalCount: items.length,
  }
}

export function useV3ListWindow<T>(items: readonly T[], { resetKey, pageSize = V3_DEFAULT_LIST_PAGE_SIZE }: { resetKey: string; pageSize?: number }): V3ListWindow<T> {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  const page = state.key === resetKey ? state.page : 1
  const window = useMemo(() => buildV3ListWindow(items, page, pageSize), [items, page, pageSize])
  return { ...window, setPage: (nextPage) => setState({ key: resetKey, page: Math.max(1, Math.min(window.pageCount, nextPage)) }) }
}
