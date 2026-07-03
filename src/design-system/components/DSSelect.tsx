import type { ReactNode, SelectHTMLAttributes } from 'react'
import './design-system.css'

interface DSSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string | null
  children: ReactNode
}

export function DSSelect({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: DSSelectProps) {
  const select = (
    <select
      id={id}
      className={['ds-select', error ? 'ds-select--error' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={Boolean(error) || props['aria-invalid']}
      {...props}
    >
      {children}
    </select>
  )

  if (!label && !hint && !error) {
    return select
  }

  return (
    <label className="ds-field" htmlFor={id}>
      {label ? <span className="ds-field__label">{label}</span> : null}
      {select}
      {error ? <p className="ds-field__hint">{error}</p> : hint ? <p className="ds-field__hint">{hint}</p> : null}
    </label>
  )
}
