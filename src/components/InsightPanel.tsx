import { type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

interface InsightPanelProps {
  title: string
  insight: string
  implication: string
  action: string
  tone?: SeverityTone
}

export function InsightPanel({
  title,
  insight,
  implication,
  action,
  tone = 'neutral',
}: InsightPanelProps) {
  return (
    <section className={['cc-insight-panel', `cc-insight-panel--${tone}`].join(' ')}>
      <h3 className="cc-insight-panel__title">{title}</h3>
      <div className="cc-insight-panel__body">
        <p className="cc-insight-panel__line"><strong>Que pasa:</strong> {insight}</p>
        <p className="cc-insight-panel__line"><strong>Que implica:</strong> {implication}</p>
        <p className="cc-insight-panel__line"><strong>Que hago:</strong> {action}</p>
      </div>
    </section>
  )
}
