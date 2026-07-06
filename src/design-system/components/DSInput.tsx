import { forwardRef, type InputHTMLAttributes } from 'react'
import './design-system.css'

interface DSInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
}

export const DSInput = forwardRef<HTMLInputElement, DSInputProps>(function DSInput({
  label,
  hint,
  error,
  className,
  id,
  ...props
}, ref) {
  const input = (
    <input
      ref={ref}
      id={id}
      className={['ds-input', error ? 'ds-input--error' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={Boolean(error) || props['aria-invalid']}
      {...props}
    />
  )

  if (!label && !hint && !error) {
    return input
  }

  return (
    <label className="ds-field" htmlFor={id}>
      {label ? <span className="ds-field__label">{label}</span> : null}
      {input}
      {error ? <p className="ds-field__hint">{error}</p> : hint ? <p className="ds-field__hint">{hint}</p> : null}
    </label>
  )
})
