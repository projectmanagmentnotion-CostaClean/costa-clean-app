import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './design-system.css'

interface DSFilterSummaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  label: string
  detail?: string
  badge?: string | null
  active?: boolean
}

export function DSFilterSummaryButton({
  icon,
  label,
  detail,
  badge = null,
  active = false,
  className,
  type,
  ...props
}: DSFilterSummaryButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={[
        'ds-filter-summary-button',
        active ? 'ds-filter-summary-button--active' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {icon ? <span className="ds-filter-summary-button__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ds-filter-summary-button__copy">
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
      {badge ? <span className="ds-filter-summary-button__badge">{badge}</span> : null}
    </button>
  )
}
