import { useCallback, useMemo, useState } from 'react'
export function useV3Selection({ visibleIds, resetKey }: { visibleIds: string[]; resetKey: string }) {
  const [state, setState] = useState({ key: resetKey, mode: false, ids: [] as string[] })
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds])
  const active = state.key === resetKey ? state : { key: resetKey, mode: false, ids: [] as string[] }
  const selectedIds = active.ids.filter((id) => visibleSet.has(id))
  const update = useCallback((ids: string[], mode = true) => setState({ key: resetKey, mode, ids }), [resetKey])
  const exit = useCallback(() => update([], false), [update])
  const toggle = useCallback((id: string) => update(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]), [selectedIds, update])
  const selectVisible = useCallback(() => { const all = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)); update(all ? selectedIds.filter((id) => !visibleSet.has(id)) : [...new Set([...selectedIds, ...visibleIds])]) }, [selectedIds, update, visibleIds, visibleSet])
  return { isSelectionMode: active.mode, selectedIds, selectedCount: selectedIds.length, visibleSelectedCount: visibleIds.filter((id) => selectedIds.includes(id)).length, allVisibleSelected: visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)), enter: () => update(selectedIds), exit, toggle, selectVisible, clear: () => update([]) }
}
