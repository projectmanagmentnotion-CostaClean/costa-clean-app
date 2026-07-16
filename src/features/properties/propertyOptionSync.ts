import type { PropertyListItem } from './types'

export function mergePropertyOptions(baseProperties: PropertyListItem[], syncedProperties: PropertyListItem[]): PropertyListItem[] {
  const byId = new Map<string, PropertyListItem>()

  for (const property of baseProperties) {
    byId.set(property.id, property)
  }

  for (const property of syncedProperties) {
    if (!byId.has(property.id)) {
      byId.set(property.id, property)
    }
  }

  return [...byId.values()]
}

export function pruneSyncedPropertyOptions(baseProperties: PropertyListItem[], syncedProperties: PropertyListItem[]): PropertyListItem[] {
  const baseIds = new Set(baseProperties.map((property) => property.id))
  return syncedProperties.filter((property) => !baseIds.has(property.id))
}

export function buildClientPropertyOptions(
  baseProperties: PropertyListItem[],
  syncedProperties: PropertyListItem[],
  clientId: string,
): PropertyListItem[] {
  if (!clientId) return []
  return mergePropertyOptions(baseProperties, syncedProperties)
    .filter((property) => property.client_id === clientId)
}
