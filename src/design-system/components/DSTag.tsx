import type { HTMLAttributes, ReactNode } from 'react'
import './design-system.css'

interface DSTagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

export function DSTag({ children, className, ...props }: DSTagProps) {
  return (
    <span className={['ds-tag', className ?? ''].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  )
}
