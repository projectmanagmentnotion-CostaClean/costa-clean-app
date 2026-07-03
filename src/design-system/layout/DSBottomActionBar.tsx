import type { ReactNode } from 'react'
import './ds-layout.css'

interface DSBottomActionBarProps {
  title?: string
  description?: string
  actions: ReactNode
}

export function DSBottomActionBar({
  title,
  description,
  actions,
}: DSBottomActionBarProps) {
  return (
    <section className="ds-bottom-action-bar">
      {(title || description) ? (
        <div className="ds-bottom-action-bar__copy">
          {title ? <strong className="ds-bottom-action-bar__title">{title}</strong> : null}
          {description ? <p className="ds-bottom-action-bar__description">{description}</p> : null}
        </div>
      ) : null}
      <div className="ds-bottom-action-bar__actions">
        {actions}
      </div>
    </section>
  )
}
