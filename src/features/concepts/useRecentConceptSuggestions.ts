import { useCallback, useMemo, useState } from 'react'
import type { ConceptSuggestion } from './conceptMemory'

const recentConceptStorageKey = 'costa-clean:recent-line-concepts'
const maxRecentConcepts = 20

interface RecentConceptEntry {
  key: string
  label: string
  usedAt: string
}

function normalizeConcept(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeConcept(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function looksSensitive(value: string) {
  return /@/.test(value) || /\d{7,}/.test(value) || /^[A-Z]?\d{8}[A-Z]?$/i.test(value.trim())
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readStoredConcepts(): RecentConceptEntry[] {
  if (!canUseLocalStorage()) return []

  try {
    const storedValue = window.localStorage.getItem(recentConceptStorageKey)
    if (!storedValue) return []
    const parsed = JSON.parse(storedValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredConcepts(entries: RecentConceptEntry[]) {
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.setItem(recentConceptStorageKey, JSON.stringify(entries))
  } catch {
    // Best effort only; autocomplete must still work without persistence.
  }
}

export function useRecentConceptSuggestions(query: string, limit = 5) {
  const [entries, setEntries] = useState<RecentConceptEntry[]>(() => readStoredConcepts())

  const saveRecentConcept = useCallback((rawValue: string) => {
    const label = sanitizeConcept(rawValue)
    const key = normalizeConcept(label)
    if (key.length < 4 || label.length > 80 || looksSensitive(label)) return false

    const nextEntries = [
      { key, label, usedAt: new Date().toISOString() },
      ...entries.filter((entry) => entry.key !== key),
    ].slice(0, maxRecentConcepts)

    setEntries(nextEntries)
    writeStoredConcepts(nextEntries)
    return true
  }, [entries])

  const recentSuggestions = useMemo<ConceptSuggestion[]>(() => {
    const normalizedQuery = normalizeConcept(query)
    const filteredEntries = normalizedQuery
      ? entries.filter((entry) => entry.key.includes(normalizedQuery))
      : entries

    return filteredEntries.slice(0, limit).map((entry) => ({
      key: `recent:${entry.key}`,
      label: entry.label,
      reasons: ['Reciente'],
      domain: 'quote',
    }))
  }, [entries, limit, query])

  return {
    recentSuggestions,
    saveRecentConcept,
  }
}
