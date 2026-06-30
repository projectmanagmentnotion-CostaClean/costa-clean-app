import type { ReactNode } from 'react'
import { ProgressMetric } from './ProgressMetric'
import { SeverityBadge, type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

interface VisualKpiCardAction {
  label: string
  onClick: () => void
}

interface VisualKpiCardProgress {
  label: string
  percent: number
  value?: string
  max?: string
  hint?: string
}

interface VisualKpiCardProps {
  label: string
  value: string
  hint?: string
  tone?: SeverityTone
  priority?: 'primary' | 'secondary' | 'compact'
  badgeLabel?: string
  progress?: VisualKpiCardProgress
  action?: VisualKpiCardAction
  children?: ReactNode
}

export function VisualKpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  priority = 'secondary',
  badgeLabel,
  progress,
  action,
  children,
}: VisualKpiCardProps) {
  const className = [
    'cc-kpi-card',
    'cc-visual-kpi-card',
    `cc-visual-kpi-card--${priority}`,
    `cc-visual-kpi-card--${tone}`,
    action ? 'cc-kpi-card--actionable' : '',
  ].filter(Boolean).join(' ')

  const content = (
    <>
      <div className="cc-visual-kpi-card__topline">
        <div>
          <span className="cc-visual-kpi-card__label">{label}</span>
          <strong className="cc-visual-kpi-card__value">{value}</strong>
        </div>
        {badgeLabel ? <SeverityBadge label={badgeLabel} tone={tone} /> : null}
      </div>
      {hint ? <p className="cc-visual-kpi-card__hint">{hint}</p> : null}
      {children}
      {(progress || action) ? (
        <div className="cc-visual-kpi-card__footer">
          {progress ? (
            <div className="cc-visual-kpi-card__progress">
              <ProgressMetric
                label={progress.label}
                percent={progress.percent}
                value={progress.value}
                max={progress.max}
                hint={progress.hint}
                tone={tone}
              />
            </div>
          ) : <span />}
          {action ? <span className="cc-visual-kpi-card__action-label">{action.label}</span> : null}
        </div>
      ) : null}
    </>
  )

  if (action) {
    return (
      <button type="button" className={className} onClick={action.onClick}>
        {content}
      </button>
    )
  }

  return (
    <article className={className}>
      {content}
    </article>
  )
}
