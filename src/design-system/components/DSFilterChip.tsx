import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './design-system.css'

interface DSFilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
}

export function DSFilterChip({ active = false, children, className, type, ...props }: DSFilterChipProps) {
  return (
    <button
      type={type ?? 'button'}
      className={['ds-filter-chip', active ? 'ds-filter-chip--active' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  )
}
