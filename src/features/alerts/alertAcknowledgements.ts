import type { AutomationAlertItem } from '../automation/types'

export type AlertAcknowledgementStatus = 'seen' | 'snoozed' | 'dismissed'

export interface AlertAcknowledgementEntry {
  alertKey: string
  status: AlertAcknowledgementStatus
  updatedAt: string
  snoozeUntil?: string
}

export const alertAcknowledgementsStorageKey = 'costa-clean:alert-acknowledgements'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function readAlertAcknowledgements(): Record<string, AlertAcknowledgementEntry> {
  if (!canUseLocalStorage()) return {}

  try {
    const storedValue = window.localStorage.getItem(alertAcknowledgementsStorageKey)
    if (!storedValue) return {}
    const parsed = JSON.parse(storedValue)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, AlertAcknowledgementEntry> : {}
  } catch {
    return {}
  }
}

export function writeAlertAcknowledgements(entries: Record<string, AlertAcknowledgementEntry>) {
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.setItem(alertAcknowledgementsStorageKey, JSON.stringify(entries))
  } catch {
    // Home noise control only.
  }
}

export function getAlertAcknowledgementKey(alert: AutomationAlertItem) {
  return alert.id
}

export function createTomorrowIsoReference() {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 1)
  nextDate.setHours(6, 0, 0, 0)
  return nextDate.toISOString()
}

export function isAlertSuppressedInHome(
  alert: AutomationAlertItem,
  entry: AlertAcknowledgementEntry | undefined,
  referenceIso = new Date().toISOString(),
) {
  if (!entry) return false
  if (entry.status === 'seen') return false
  if (entry.status === 'dismissed') return alert.severity !== 'critical'
  if (entry.status === 'snoozed') {
    if (!entry.snoozeUntil) return false
    return entry.snoozeUntil > referenceIso
  }
  return false
}

export function upsertAlertAcknowledgement(
  currentEntries: Record<string, AlertAcknowledgementEntry>,
  alertKey: string,
  status: AlertAcknowledgementStatus,
  options?: { snoozeUntil?: string },
) {
  const nextEntries = {
    ...currentEntries,
    [alertKey]: {
      alertKey,
      status,
      updatedAt: new Date().toISOString(),
      snoozeUntil: options?.snoozeUntil,
    },
  }
  writeAlertAcknowledgements(nextEntries)
  return nextEntries
}
