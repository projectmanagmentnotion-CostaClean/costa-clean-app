import { SeverityBadge, type SeverityTone } from './SeverityBadge'
import './visual-ux-system.css'

type ChecklistItemState = 'done' | 'pending' | 'warning' | 'critical' | 'info'

interface ChecklistItemAction {
  label: string
  onClick: () => void
}

export interface ActionChecklistItem {
  id: string
  state: ChecklistItemState
  label: string
  description?: string
  action?: ChecklistItemAction
}

interface ActionChecklistProps {
  items: ActionChecklistItem[]
  compact?: boolean
}

function getToneForState(state: ChecklistItemState): SeverityTone {
  if (state === 'done') return 'success'
  if (state === 'warning' || state === 'pending') return 'warning'
  if (state === 'critical') return 'critical'
  if (state === 'info') return 'info'
  return 'neutral'
}

function getLabelForState(state: ChecklistItemState): string {
  if (state === 'done') return 'Hecho'
  if (state === 'pending') return 'Pendiente'
  if (state === 'warning') return 'Revisar'
  if (state === 'critical') return 'Bloquea'
  return 'Contexto'
}

export function ActionChecklist({
  items,
  compact = false,
}: ActionChecklistProps) {
  return (
    <div className={['cc-action-checklist', compact ? 'cc-action-checklist--compact' : ''].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <article key={item.id} className={['cc-action-checklist__item', `cc-action-checklist__item--${item.state === 'pending' ? 'warning' : item.state}`].join(' ')}>
          <div className="cc-action-checklist__header">
            <div className="cc-action-checklist__copy">
              <strong className="cc-action-checklist__label">{item.label}</strong>
              {item.description ? <p className="cc-action-checklist__description">{item.description}</p> : null}
            </div>
            <SeverityBadge label={getLabelForState(item.state)} tone={getToneForState(item.state)} />
          </div>
          {item.action ? (
            <button type="button" className="secondary-button cc-action-checklist__action" onClick={item.action.onClick}>
              {item.action.label}
            </button>
          ) : null}
        </article>
      ))}
    </div>
  )
}
