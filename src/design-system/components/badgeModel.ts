export type DSBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function getDSBadgeSeverityTone(tone: DSBadgeTone) {
  return tone === 'danger' ? 'critical' : tone
}
