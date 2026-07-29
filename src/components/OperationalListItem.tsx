import type { ReactNode } from 'react'
import { ActionGroup, type ActionGroupItem } from './ActionGroup'

export type OperationalListAction = ActionGroupItem

interface OperationalListItemProps {
  dataQa?: string
  selected: boolean
  onSelect: () => void
  title: string
  subtitle?: string
  status?: ReactNode
  aside?: ReactNode
  summary?: string
  chips?: string[]
  meta?: Array<{ label: string; value: string }>
  actions?: OperationalListAction[]
  compactVisibleSecondaryActionCount?: number
  microhint?: string
  selectionControl?: ReactNode
}

export function OperationalListItem({
  dataQa,
  selected,
  onSelect,
  title,
  subtitle,
  status,
  aside,
  summary,
  chips = [],
  meta = [],
  actions = [],
  compactVisibleSecondaryActionCount = 0,
  microhint,
  selectionControl,
}: OperationalListItemProps) {
  return (
    <article data-qa={dataQa} className={selected ? 'cc-operational-item is-selected' : 'cc-operational-item'}>
      {selectionControl ? <div className="cc-operational-item__selection">{selectionControl}</div> : null}

      <button
        type="button"
        className="cc-operational-item__select"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <div className="cc-operational-item__head">
          <div className="cc-operational-item__identity">
            <strong className="cc-operational-item__title">{title}</strong>
            {subtitle ? <span className="cc-operational-item__subtitle">{subtitle}</span> : null}
          </div>

          {(status || aside) ? (
            <div className="cc-operational-item__aside">
              {status}
              {aside}
            </div>
          ) : null}
        </div>

        {summary ? <p className="cc-operational-item__summary">{summary}</p> : null}

        {chips.length > 0 ? (
          <div className="cc-operational-item__chips" aria-label="Contexto del registro">
            {chips.slice(0, 1).map((chip) => (
              <span key={chip} className="cc-operational-item__chip">{chip}</span>
            ))}
          </div>
        ) : null}

        {meta.length > 0 ? (
          <div className="cc-operational-item__meta">
            {meta.slice(0, 1).map((item) => (
              <span key={`${item.label}-${item.value}`}>
                <span className="cc-operational-item__meta-label">{item.label}</span>
                <span className="cc-operational-item__meta-value">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </button>

      {(actions.length > 0 || microhint) ? (
        <div className="cc-operational-item__footer">
          {actions.length > 0 ? (
            <ActionGroup
              actions={actions}
              compactVisibleSecondaryCount={compactVisibleSecondaryActionCount}
            />
          ) : <span />}

          {microhint ? <span className="cc-operational-item__microhint">{microhint}</span> : null}
        </div>
      ) : null}
    </article>
  )
}
