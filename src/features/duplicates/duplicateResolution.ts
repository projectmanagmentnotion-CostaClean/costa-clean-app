import { useEffect, useMemo, useState } from 'react'
import type { DuplicateGroup } from './types'

const duplicateResolutionStorageKey = 'costaclean-duplicate-resolutions'

export type DuplicateResolutionStatus = 'reviewed' | 'ignored'

interface DuplicateResolutionEntry {
  status: DuplicateResolutionStatus
  updatedAt: string
}

type DuplicateResolutionMap = Record<string, DuplicateResolutionEntry>

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readDuplicateResolutionMap(): DuplicateResolutionMap {
  if (!canUseStorage()) return {}

  try {
    const storedValue = window.localStorage.getItem(duplicateResolutionStorageKey)
    if (!storedValue) return {}
    const parsed = JSON.parse(storedValue)
    return parsed && typeof parsed === 'object' ? parsed as DuplicateResolutionMap : {}
  } catch {
    return {}
  }
}

function writeDuplicateResolutionMap(nextMap: DuplicateResolutionMap) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(duplicateResolutionStorageKey, JSON.stringify(nextMap))
  } catch {
    // Duplicate review persistence is helpful, not business-critical.
  }
}

export function buildDuplicatePairResolutionKeys<TRecord>(group: DuplicateGroup<TRecord>) {
  const recordIds = [...group.records].map((record) => record.recordId).sort()
  const reasonCodes = [...group.reasons].map((reason) => reason.code).sort().join('::')
  const keys: string[] = []

  for (let index = 0; index < recordIds.length; index += 1) {
    for (let cursor = index + 1; cursor < recordIds.length; cursor += 1) {
      keys.push(`${group.entityType}__${recordIds[index]}__${recordIds[cursor]}__${reasonCodes}`)
    }
  }

  return keys
}

export function useDuplicateResolution<TRecord>(groups: Array<DuplicateGroup<TRecord>>) {
  const [resolutionMap, setResolutionMap] = useState<DuplicateResolutionMap>(() => readDuplicateResolutionMap())

  useEffect(() => {
    writeDuplicateResolutionMap(resolutionMap)
  }, [resolutionMap])

  const resolutionKeyByGroupId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const group of groups) {
      map.set(group.groupId, buildDuplicatePairResolutionKeys(group))
    }
    return map
  }, [groups])

  const reviewStateByGroupId = useMemo(() => {
    const nextState: Record<string, 'open' | DuplicateResolutionStatus> = {}

    for (const group of groups) {
      const resolutionKeys = resolutionKeyByGroupId.get(group.groupId) ?? []
      const statuses = resolutionKeys
        .map((resolutionKey) => resolutionMap[resolutionKey]?.status)
        .filter((status): status is DuplicateResolutionStatus => Boolean(status))

      if (resolutionKeys.length === 0 || statuses.length === 0) {
        nextState[group.groupId] = 'open'
        continue
      }

      const allIgnored = statuses.length === resolutionKeys.length && statuses.every((status) => status === 'ignored')
      if (allIgnored) {
        nextState[group.groupId] = 'ignored'
        continue
      }

      const allResolved = statuses.length === resolutionKeys.length && statuses.every((status) => status === 'reviewed' || status === 'ignored')
      nextState[group.groupId] = allResolved ? 'reviewed' : 'open'
    }

    return nextState
  }, [groups, resolutionKeyByGroupId, resolutionMap])

  const unresolvedGroups = useMemo(
    () => groups.filter((group) => reviewStateByGroupId[group.groupId] === 'open'),
    [groups, reviewStateByGroupId],
  )
  const reviewedGroups = useMemo(
    () => groups.filter((group) => reviewStateByGroupId[group.groupId] === 'reviewed'),
    [groups, reviewStateByGroupId],
  )
  const ignoredGroups = useMemo(
    () => groups.filter((group) => reviewStateByGroupId[group.groupId] === 'ignored'),
    [groups, reviewStateByGroupId],
  )
  const visibleGroups = useMemo(
    () => [...unresolvedGroups, ...reviewedGroups],
    [reviewedGroups, unresolvedGroups],
  )

  function updateGroupState(groupId: string, status: DuplicateResolutionStatus | null) {
    const resolutionKeys = resolutionKeyByGroupId.get(groupId)
    if (!resolutionKeys || resolutionKeys.length === 0) return

    setResolutionMap((current) => {
      if (status === null) {
        const next = { ...current }
        for (const resolutionKey of resolutionKeys) {
          delete next[resolutionKey]
        }
        return next
      }

      const next = { ...current }
      const updatedAt = new Date().toISOString()
      for (const resolutionKey of resolutionKeys) {
        next[resolutionKey] = {
          status,
          updatedAt,
        }
      }

      return {
        ...next,
      }
    })
  }

  return {
    visibleGroups,
    unresolvedGroups,
    reviewedGroups,
    ignoredGroups,
    unresolvedCount: unresolvedGroups.length,
    reviewedCount: reviewedGroups.length,
    ignoredCount: ignoredGroups.length,
    reviewStateByGroupId,
    markReviewed: (groupId: string) => updateGroupState(groupId, 'reviewed'),
    ignoreGroup: (groupId: string) => updateGroupState(groupId, 'ignored'),
    reopenGroup: (groupId: string) => updateGroupState(groupId, null),
  }
}
