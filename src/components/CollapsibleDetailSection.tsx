import type { ReactNode } from 'react'
import { SeverityBadge, type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

interface CollapsibleDetailSectionProps {
  title: string
  count?: number | string
  defaultOpen?: boolean
  tone?: SeverityTone
  children: ReactNode
}

export function CollapsibleDetailSection({
  title,
  count,
  defaultOpen = false,
  tone = 'neutral',
  children,
}: CollapsibleDetailSectionProps) {
  return (
    <details className={['cc-collapsible-detail', tone !== 'neutral' ? `cc-collapsible-detail--${tone}` : ''].filter(Boolean).join(' ')} open={defaultOpen}>
      <summary className="cc-collapsible-detail__summary">
        <span className="cc-collapsible-detail__title-wrap">
          <span className="cc-collapsible-detail__title">{title}</span>
          {typeof count !== 'undefined' ? <span className="cc-collapsible-detail__count">{count}</span> : null}
        </span>
        <SeverityBadge label="Detalle" tone={tone} />
      </summary>
      <div className="cc-collapsible-detail__body">
        {children}
      </div>
    </details>
  )
}
