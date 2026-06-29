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

export function buildDuplicateResolutionKey<TRecord>(group: DuplicateGroup<TRecord>) {
  const recordIds = [...group.records].map((record) => record.recordId).sort().join('::')
  const reasonCodes = [...group.reasons].map((reason) => reason.code).sort().join('::')
  return `${group.entityType}__${recordIds}__${reasonCodes}`
}

export function useDuplicateResolution<TRecord>(groups: Array<DuplicateGroup<TRecord>>) {
  const [resolutionMap, setResolutionMap] = useState<DuplicateResolutionMap>(() => readDuplicateResolutionMap())

  useEffect(() => {
    writeDuplicateResolutionMap(resolutionMap)
  }, [resolutionMap])

  const resolutionKeyByGroupId = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groups) {
      map.set(group.groupId, buildDuplicateResolutionKey(group))
    }
    return map
  }, [groups])

  const reviewStateByGroupId = useMemo(() => {
    const nextState: Record<string, 'open' | DuplicateResolutionStatus> = {}

    for (const group of groups) {
      const resolutionKey = resolutionKeyByGroupId.get(group.groupId)
      const storedState = resolutionKey ? resolutionMap[resolutionKey]?.status : undefined
      nextState[group.groupId] = storedState ?? 'open'
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
    const resolutionKey = resolutionKeyByGroupId.get(groupId)
    if (!resolutionKey) return

    setResolutionMap((current) => {
      if (status === null) {
        const next = { ...current }
        delete next[resolutionKey]
        return next
      }

      return {
        ...current,
        [resolutionKey]: {
          status,
          updatedAt: new Date().toISOString(),
        },
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
