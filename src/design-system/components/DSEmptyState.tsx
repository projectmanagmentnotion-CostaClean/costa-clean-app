import type { ReactNode } from 'react'
import './design-system.css'

interface DSEmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function DSEmptyState({ title, description, action }: DSEmptyStateProps) {
  return (
    <section className="ds-state ds-state--empty ds-state--compact empty-state">
      <strong className="ds-state__title">{title}</strong>
      <p className="ds-state__description">{description}</p>
      {action}
    </section>
  )
}
