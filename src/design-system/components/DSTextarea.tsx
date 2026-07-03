import type { TextareaHTMLAttributes } from 'react'
import './design-system.css'

interface DSTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string | null
}

export function DSTextarea({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: DSTextareaProps) {
  const textarea = (
    <textarea
      id={id}
      className={['ds-textarea', error ? 'ds-textarea--error' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={Boolean(error) || props['aria-invalid']}
      {...props}
    />
  )

  if (!label && !hint && !error) {
    return textarea
  }

  return (
    <label className="ds-field" htmlFor={id}>
      {label ? <span className="ds-field__label">{label}</span> : null}
      {textarea}
      {error ? <p className="ds-field__hint">{error}</p> : hint ? <p className="ds-field__hint">{hint}</p> : null}
    </label>
  )
}
