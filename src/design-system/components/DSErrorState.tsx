import type { ReactNode } from 'react'
import './design-system.css'

interface DSErrorStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function DSErrorState({ title, description, action }: DSErrorStateProps) {
  return (
    <section className="ds-state ds-state--error cc-alert cc-alert--error">
      <strong className="ds-state__title">{title}</strong>
      <p className="ds-state__description">{description}</p>
      {action}
    </section>
  )
}
