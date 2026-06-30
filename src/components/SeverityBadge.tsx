import './visual-ux-system.css'

export type SeverityTone = 'success' | 'info' | 'warning' | 'critical' | 'neutral'

interface SeverityBadgeProps {
  label: string
  tone?: SeverityTone
  className?: string
}

export function SeverityBadge({
  label,
  tone = 'neutral',
  className,
}: SeverityBadgeProps) {
  return (
    <span className={['cc-severity-badge', `cc-severity-badge--${tone}`, className].filter(Boolean).join(' ')}>
      {label}
    </span>
  )
}
