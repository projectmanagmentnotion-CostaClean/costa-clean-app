import { useEffect, useMemo, useState } from 'react'
import { listAlertDecisions, saveAlertDecision } from '../alerts/alertDecisionApi'
import type { DuplicateGroup } from './types'

export type DuplicateResolutionStatus = 'reviewed' | 'ignored'

interface DuplicateResolutionEntry {
  status: DuplicateResolutionStatus
  updatedAt: string
}

type DuplicateResolutionMap = Record<string, DuplicateResolutionEntry>

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

export function buildDuplicateFingerprint<TRecord>(group: DuplicateGroup<TRecord>) {
  return buildDuplicatePairResolutionKeys(group).sort().join('||')
}

export function useDuplicateResolution<TRecord>(groups: Array<DuplicateGroup<TRecord>>) {
  const [resolutionMap, setResolutionMap] = useState<DuplicateResolutionMap>({})

  useEffect(() => {
    let mounted = true
    void listAlertDecisions()
      .then((decisions) => {
        if (!mounted) return
        const nextMap: DuplicateResolutionMap = {}
        for (const decision of decisions) {
          if (!decision.alert_key.startsWith('duplicate:') || decision.scope !== 'global') continue
          if (decision.status !== 'dismissed' && decision.status !== 'acknowledged') continue
          nextMap[decision.fingerprint] = {
            status: decision.status === 'dismissed' ? 'ignored' : 'reviewed',
            updatedAt: decision.updated_at,
          }
        }
        setResolutionMap(nextMap)
      })
      .catch(() => {
        // A missing migration must not make duplicate review crash the workspace.
      })

    return () => {
      mounted = false
    }
  }, [])

  const fingerprintByGroupId = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groups) map.set(group.groupId, buildDuplicateFingerprint(group))
    return map
  }, [groups])

  const reviewStateByGroupId = useMemo(() => {
    const nextState: Record<string, 'open' | DuplicateResolutionStatus> = {}

    for (const group of groups) {
      const fingerprint = fingerprintByGroupId.get(group.groupId)
      const status = fingerprint ? resolutionMap[fingerprint]?.status : undefined

      if (!status) {
        nextState[group.groupId] = 'open'
        continue
      }

      if (status === 'ignored') {
        nextState[group.groupId] = 'ignored'
        continue
      }
      nextState[group.groupId] = 'reviewed'
    }

    return nextState
  }, [fingerprintByGroupId, groups, resolutionMap])

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
    const group = groups.find((candidate) => candidate.groupId === groupId)
    const fingerprint = fingerprintByGroupId.get(groupId)
    if (!group || !fingerprint) return

    setResolutionMap((current) => {
      if (status === null) {
        const next = { ...current }
        delete next[fingerprint]
        void saveAlertDecision({
          alertKey: `duplicate:${group.entityType}:${fingerprint}`,
          fingerprint,
          scope: 'global',
          status: 'open',
          metadata: { entityType: group.entityType, recordIds: group.records.map((record) => record.recordId) },
        }).catch(() => undefined)
        return next
      }

      const next = { ...current }
      const updatedAt = new Date().toISOString()
      next[fingerprint] = { status, updatedAt }
      void saveAlertDecision({
        alertKey: `duplicate:${group.entityType}:${fingerprint}`,
        fingerprint,
        scope: 'global',
        status: status === 'ignored' ? 'dismissed' : 'acknowledged',
        metadata: { entityType: group.entityType, recordIds: group.records.map((record) => record.recordId) },
      }).catch(() => undefined)

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
