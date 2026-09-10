import type { InputHTMLAttributes, MouseEvent, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export type V3IconName = 'back' | 'chevronDown'

export function V3Icon({ name, size = 16 }: { name: V3IconName; size?: number }) {
  const paths: Record<V3IconName, string> = {
    back: 'M19 12H5M11 18l-6-6 6-6',
    chevronDown: 'm5 9 7 7 7-7',
  }
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d={paths[name]} /></svg>
}

interface V3ActionProps {
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
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

export const V3Status = V3EntityStatus

export function V3PrimaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--primary" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
}

export function V3SecondaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--secondary" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
}

export function V3DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="v3-detail-section"><h2>{title}</h2>{children}</section>
}

export function V3Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return <section className="v3-section"><div className="v3-section__header"><h2>{label}</h2>{action ? <div>{action}</div> : null}</div>{children}</section>
}

export function V3EntityList({ children, label }: { children: ReactNode; label: string }) {
  return <div className="v3-entity-list" role="list" aria-label={label}>{children}</div>
}

export function V3EntityListItem({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel: string }) {
  return <article className="v3-entity-list-item" role="listitem" tabIndex={0} aria-label={ariaLabel} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}>{children}</article>
}

export function V3QuickAction({ children, onClick, disabled = false }: V3ActionProps) {
  return <button type="button" className="v3-action v3-action--ghost" onClick={(event) => { event.stopPropagation(); onClick?.(event) }} disabled={disabled}>{children}</button>
}

export function V3BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="v3-bottom-sheet__layer"><button type="button" className="v3-bottom-sheet__backdrop" aria-label={`Cerrar ${title}`} onClick={onClose} /><section className="v3-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}><div className="v3-bottom-sheet__handle" aria-hidden="true" /><div className="v3-bottom-sheet__header"><h2>{title}</h2><button type="button" className="v3-action v3-action--secondary" onClick={onClose}>Cerrar</button></div>{children}</section></div>
}

export function V3Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="v3-field"><span>{label}</span>{children}</label>
}

export function V3Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`v3-input ${props.className ?? ''}`.trim()} />
}

export function V3Search(props: InputHTMLAttributes<HTMLInputElement>) {
  return <V3Input {...props} type="search" aria-label={props['aria-label'] ?? 'Buscar'} />
}

export function V3Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`v3-input ${props.className ?? ''}`.trim()} />
}

export function V3Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`v3-input v3-textarea ${props.className ?? ''}`.trim()} />
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
