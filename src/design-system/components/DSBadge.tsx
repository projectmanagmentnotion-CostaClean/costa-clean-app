import { SeverityBadge, type SeverityTone } from '../../components/SeverityBadge'
import './design-system.css'

interface DSBadgeProps {
  label: string
  tone?: SeverityTone
  className?: string
}

export function DSBadge({ label, tone = 'neutral', className }: DSBadgeProps) {
  return (
    <span className={['ds-badge', className ?? ''].filter(Boolean).join(' ')}>
      <SeverityBadge label={label} tone={tone} />
    </span>
  )
}
