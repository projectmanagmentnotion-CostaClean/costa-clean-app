import type { ReactNode } from 'react'
import './contextual-create.css'

interface ContextualCreateSectionProps {
  actionLabel: string
  title: string
  description: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

export function ContextualCreateSection({
  actionLabel,
  title,
  description,
  isOpen,
  onToggle,
  children,
}: ContextualCreateSectionProps) {
  return (
    <section className={isOpen ? 'cc-contextual-create is-open' : 'cc-contextual-create'}>
      <div className="cc-contextual-create__header">
        <div className="cc-contextual-create__copy">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>

        <button
          type="button"
          className={isOpen ? 'secondary-button' : 'secondary-button secondary-button--quiet'}
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Cerrar subflujo' : actionLabel}
        </button>
      </div>

      {isOpen ? (
        <div className="cc-contextual-create__body">
          {children}
        </div>
      ) : null}
    </section>
  )
}
