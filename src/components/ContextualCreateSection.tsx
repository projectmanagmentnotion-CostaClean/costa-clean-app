import type { ReactNode } from 'react'
import { NestedFlowSurfaceContext } from './NestedFlowSurfaceContext'
import './contextual-create.css'

interface ContextualCreateSectionProps {
  actionLabel: string
  title: string
  description: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  backLabel?: string
}

export function ContextualCreateSection({
  actionLabel,
  title,
  description,
  isOpen,
  onToggle,
  children,
  backLabel = 'Volver al flujo',
}: ContextualCreateSectionProps) {
  if (isOpen) {
    return (
      <section className="cc-contextual-create cc-contextual-create--takeover">
        <div className="cc-contextual-create__takeover-head">
          <div className="cc-contextual-create__copy">
            <span className="cc-contextual-create__eyebrow">Contexto pendiente</span>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>

          <button
            type="button"
            className="secondary-button secondary-button--quiet"
            onClick={onToggle}
          >
            {backLabel}
          </button>
        </div>

        <div className="cc-contextual-create__takeover-body">
          <NestedFlowSurfaceContext.Provider value={true}>
            {children}
          </NestedFlowSurfaceContext.Provider>
        </div>
      </section>
    )
  }

  return (
    <section className="cc-contextual-create">
      <div className="cc-contextual-create__header">
        <div className="cc-contextual-create__copy">
          <span className="cc-contextual-create__eyebrow">Contexto pendiente</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={onToggle}
          aria-expanded={false}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  )
}
