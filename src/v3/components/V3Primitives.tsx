import type { ReactNode } from 'react'

interface V3ActionProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  ariaLabel?: string
}

export function V3Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`v3-page ${className}`.trim()}>{children}</div>
}

export function V3PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="v3-page-title">
      <div>
        {eyebrow ? <span className="v3-page-title__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="v3-page-title__action">{action}</div> : null}
    </header>
  )
}

export function V3Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <article className="v3-kpi"><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</article>
}

export function V3KpiGroup({ children }: { children: ReactNode }) {
  return <div className="v3-kpi-group">{children}</div>
}

export function V3EntityStatus({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <span className={`v3-status v3-status--${tone}`}>{label}</span>
}

export function V3PrimaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--primary" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
}

export function V3SecondaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--secondary" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
}

export function V3DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="v3-detail-section"><h2>{title}</h2>{children}</section>
}

export function V3Summary({ children }: { children: ReactNode }) {
  return <div className="v3-summary">{children}</div>
}

export function V3StickyActionBar({ children }: { children: ReactNode }) {
  return <div className="v3-sticky-action-bar">{children}</div>
}

export function V3EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="v3-state"><strong>{title}</strong><p>{description}</p></div>
}

export function V3LoadingState({ label = 'Cargando' }: { label?: string }) {
  return <div className="v3-state" role="status"><strong>{label}</strong></div>
}

export function V3ErrorState({ title, description }: { title: string; description: string }) {
  return <div className="v3-state v3-state--error" role="alert"><strong>{title}</strong><p>{description}</p></div>
}
