import type { V3SelectionEligibility } from './types'

export function getV3SelectionEligibility<T extends { id: string }>(items: T[], selectedIds: string[], predicate: (item: T) => boolean): V3SelectionEligibility {
  const selected = new Set(selectedIds)
  const eligibleIds: string[] = []
  const ineligibleIds: string[] = []
  items.forEach((item) => {
    if (!selected.has(item.id)) return
    ;(predicate(item) ? eligibleIds : ineligibleIds).push(item.id)
  })
  return { eligibleIds, ineligibleIds }
}
