import type { ReactNode } from 'react'
import './design-system.css'

interface DSSectionHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
}

export function DSSectionHeader({
  title,
  description,
  eyebrow,
  actions,
}: DSSectionHeaderProps) {
  return (
    <header className="ds-section-header">
      <div className="ds-section-header__copy">
        {eyebrow ? <span className="ds-section-header__eyebrow">{eyebrow}</span> : null}
        <h2 className="ds-section-header__title">{title}</h2>
        {description ? <p className="ds-section-header__description">{description}</p> : null}
      </div>
      {actions}
    </header>
  )
}
