import { type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

interface ProgressMetricProps {
  label: string
  value?: string
  max?: string
  percent: number
  tone?: SeverityTone
  hint?: string
}

export function ProgressMetric({
  label,
  value,
  max,
  percent,
  tone = 'neutral',
  hint,
}: ProgressMetricProps) {
  const normalizedPercent = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0))
  const valueLabel = value && max ? `${value}/${max}` : value ?? `${Math.round(normalizedPercent)}%`

  return (
    <div className={['cc-progress-metric', `cc-progress-metric--${tone}`].join(' ')}>
      <div className="cc-progress-metric__topline">
        <span className="cc-progress-metric__label">{label}</span>
        <strong className="cc-progress-metric__value">{valueLabel}</strong>
      </div>
      <div className="cc-progress-metric__track" aria-hidden="true">
        <span className="cc-progress-metric__fill" style={{ width: `${normalizedPercent}%` }} />
      </div>
      {hint ? <p className="cc-progress-metric__hint">{hint}</p> : null}
    </div>
  )
}
