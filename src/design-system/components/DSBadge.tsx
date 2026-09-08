import { SeverityBadge } from '../../components/SeverityBadge'
import { getDSBadgeSeverityTone, type DSBadgeTone } from './badgeModel'
import './design-system.css'

export interface DSBadgeProps {
  label: string
  tone?: DSBadgeTone
  className?: string
}

export function DSBadge({ label, tone = 'neutral', className }: DSBadgeProps) {
  return (
    <span className={['ds-badge', `ds-badge--${tone}`, className ?? ''].filter(Boolean).join(' ')}>
      <SeverityBadge label={label} tone={getDSBadgeSeverityTone(tone)} />
    </span>
  )
}
