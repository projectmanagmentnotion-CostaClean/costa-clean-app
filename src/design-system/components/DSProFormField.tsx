import type { ReactNode } from 'react'
import './design-system.css'

interface DSProFormFieldProps {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  className?: string
  children: ReactNode
}

export function DSProFormField({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: DSProFormFieldProps) {
  return (
    <div className={['ds-pro-form-field', className ?? ''].filter(Boolean).join(' ')}>
      <div className="ds-pro-form-field__head">
        <span className="ds-pro-form-field__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </span>
        {hint ? <span className="ds-pro-form-field__hint">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="ds-pro-form-field__error">{error}</p> : null}
    </div>
  )
}
