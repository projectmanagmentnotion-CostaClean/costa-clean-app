import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './design-system.css'

type DSButtonTone = 'primary' | 'secondary' | 'danger'

interface DSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  tone?: DSButtonTone
  fullWidth?: boolean
}

export function DSButton({
  children,
  className,
  tone = 'primary',
  fullWidth = false,
  type = 'button',
  ...props
}: DSButtonProps) {
  return (
    <button
      type={type}
      className={[
        'ds-button',
        `ds-button--${tone}`,
        fullWidth ? 'ds-button--full' : '',
        tone === 'primary' ? 'primary-button' : '',
        tone === 'secondary' ? 'secondary-button' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
