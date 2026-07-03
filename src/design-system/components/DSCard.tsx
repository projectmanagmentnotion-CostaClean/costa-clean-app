import type { HTMLAttributes, ReactNode } from 'react'
import './design-system.css'

type DSCardTone = 'default' | 'subtle' | 'raised'

interface DSCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'section' | 'div'
  children: ReactNode
  tone?: DSCardTone
}

export function DSCard({
  as = 'section',
  children,
  className,
  tone = 'default',
  ...props
}: DSCardProps) {
  const Component = as

  return (
    <Component
      className={['ds-card', tone !== 'default' ? `ds-card--${tone}` : '', className ?? ''].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Component>
  )
}
