import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { getDSButtonClassNames, type DSButtonTone } from './buttonModel'
import './design-system.css'

export interface DSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: DSButtonTone
  fullWidth?: boolean
  loading?: boolean
}

export function DSButton({
  children,
  className,
  tone = 'primary',
  fullWidth = false,
  loading = false,
  type = 'button',
  disabled,
  ...props
}: DSButtonProps) {
  return (
    <button
      type={type}
      className={[getDSButtonClassNames({ tone, fullWidth, loading }), className ?? ''].filter(Boolean).join(' ')}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  )
}
