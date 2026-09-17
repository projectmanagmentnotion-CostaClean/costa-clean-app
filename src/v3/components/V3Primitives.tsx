import { useEffect, useRef, type InputHTMLAttributes, type MouseEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export type V3IconName = 'alerts' | 'back' | 'camera' | 'chevronDown' | 'clients' | 'closing' | 'expenses' | 'forward' | 'home' | 'invoice' | 'jobs' | 'leads' | 'more' | 'payments' | 'properties' | 'quotes' | 'replace' | 'trash'

export function V3Icon({ name, size = 16, className = '' }: { name: V3IconName; size?: number; className?: string }) {
  const paths: Record<V3IconName, string> = {
    alerts: 'M12 4 3 20h18L12 4ZM12 10v4M12 17h.01',
    back: 'M19 12H5M11 18l-6-6 6-6',
    camera: 'M8 7 9.5 5h5L16 7h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Zm4 3.2a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z',
    chevronDown: 'm5 9 7 7 7-7',
    clients: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.1a4 4 0 0 1 0 7.8M20 20v-2a4 4 0 0 0-3-3.9',
    closing: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
    expenses: 'M4 5h16v14H4zM8 9h8M8 13h5',
    forward: 'M5 12h14M13 6l6 6-6 6',
    home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
    invoice: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6',
    jobs: 'M4 5h16v14H4zM8 3v4M16 3v4M4 10h16',
    leads: 'M12 20V10M7 20V4M17 20v-7M4 4h6M14 13h6',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    payments: 'M12 3v18M17 7.5c0-1.4-1.9-2.5-4.5-2.5S8 6.1 8 7.5 9.9 10 12.5 10s4.5 1.1 4.5 2.5-1.9 2.5-4.5 2.5S8 13.9 8 12.5',
    properties: 'M3 20V9l9-6 9 6v11M7 20v-6h10v6',
    quotes: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
    replace: 'M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M17 7l2.5 2.5L17 12M7 17l-2.5-2.5L7 12',
    trash: 'M5 7h14M10 11v6M14 11v6M9 7V5h6v2m-9 0 1 12h8l1-12',
  }
  return <svg aria-hidden="true" className={className || undefined} focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d={paths[name]} /></svg>
}

interface V3ActionProps {
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit'
  disabled?: boolean
  ariaLabel?: string
  ariaPressed?: boolean
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

export function V3KpiGroup({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'supporting' }) {
  return <div className={`v3-kpi-group v3-kpi-group--${variant}`}>{children}</div>
}

export function V3EntityStatus({ label, tone = 'neutral', context }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger'; context?: string }) {
  return <span className={`v3-status v3-status--${tone}`} aria-label={context ? `${context}: ${label}` : undefined}>{context ? <span className="v3-status__context">{context}</span> : null}{label}</span>
}

export const V3Status = V3EntityStatus

export function V3PrimaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel, ariaPressed }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--primary" onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-pressed={ariaPressed}>{children}</button>
}

export function V3SecondaryAction({ children, onClick, type = 'button', disabled = false, ariaLabel, ariaPressed }: V3ActionProps) {
  return <button type={type} className="v3-action v3-action--secondary" onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-pressed={ariaPressed}>{children}</button>
}

export function V3ActionGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`v3-action-group ${className}`.trim()}>{children}</div>
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

export function V3EntityListItem({ children, onClick, ariaLabel, className = '' }: { children: ReactNode; onClick: () => void; ariaLabel: string; className?: string }) {
  return <article className={`v3-entity-list-item ${className}`.trim()} role="listitem" tabIndex={0} aria-label={ariaLabel} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}>{children}</article>
}

export function V3QuickAction({ children, onClick, disabled = false }: V3ActionProps) {
  return <button type="button" className="v3-action v3-action--ghost" onClick={(event) => { event.stopPropagation(); onClick?.(event) }} disabled={disabled}>{children}</button>
}

function getFocusReturnDescriptor(element: HTMLElement | null) {
  if (!element) return null
  return {
    ariaLabel: element.getAttribute('aria-label'),
    text: element.textContent?.trim().replace(/\s+/gu, ' ') || null,
  }
}

function restoreFocus(previous: HTMLElement | null, descriptor: ReturnType<typeof getFocusReturnDescriptor>) {
  if (previous?.isConnected) {
    previous.focus()
    return true
  }

  if (!descriptor) return false

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])'))
    .filter((element) => element.offsetParent !== null && !element.hasAttribute('disabled'))
  const fallback = candidates.find((element) => descriptor.ariaLabel && element.getAttribute('aria-label') === descriptor.ariaLabel)
    ?? candidates.find((element) => descriptor.text && element.textContent?.trim().replace(/\s+/gu, ' ') === descriptor.text)

  fallback?.focus()
  return Boolean(fallback)
}

export function V3BottomSheet({ title, children, onClose, closeOnEscape = true, variant = 'sheet', closeLabel = 'Cerrar' }: { title: string; children: ReactNode; onClose: () => void; closeOnEscape?: boolean; variant?: 'sheet' | 'workspace'; closeLabel?: string }) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Capture the trigger during render, before a descendant with autoFocus can
  // move focus into the newly mounted sheet.
  const initialFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  const previousFocusRef = useRef<HTMLElement | null>(initialFocus)
  const previousFocusDescriptorRef = useRef<ReturnType<typeof getFocusReturnDescriptor>>(getFocusReturnDescriptor(initialFocus))
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousFocus = previousFocusRef.current
    const previousFocusDescriptor = previousFocusDescriptorRef.current
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreFocus(previousFocus, previousFocusDescriptor)
      // React may move focus to body after this cleanup removes the sheet.
      // Retry after the commit so the trigger is restored in the final DOM.
      window.setTimeout(() => restoreFocus(previousFocus, previousFocusDescriptor), 0)
    }
  }, [closeOnEscape])

  return <div className="v3-bottom-sheet__layer"><button type="button" tabIndex={-1} className="v3-bottom-sheet__backdrop" aria-label={`Cerrar ${title}`} onClick={onClose} /><section ref={dialogRef} className={`v3-bottom-sheet v3-bottom-sheet--${variant}`} role="dialog" aria-modal="true" aria-label={title}><div className="v3-bottom-sheet__handle" aria-hidden="true" /><div className="v3-bottom-sheet__header">{variant === 'workspace' ? <span className="v3-visually-hidden">{title}</span> : <h2>{title}</h2>}<button ref={closeRef} type="button" className="v3-action v3-action--secondary" onClick={onClose}>{closeLabel}</button></div>{children}</section></div>
}

export function V3ConfirmSheet({ title, description, confirmLabel, cancelLabel = 'Cancelar', busy = false, onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; cancelLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <V3BottomSheet title={title} closeOnEscape={!busy} onClose={onCancel}><p>{description}</p><div className="v3-workspace-actions"><V3SecondaryAction onClick={onCancel} disabled={busy}>{cancelLabel}</V3SecondaryAction><V3PrimaryAction onClick={onConfirm} disabled={busy}>{busy ? 'Procesando…' : confirmLabel}</V3PrimaryAction></div></V3BottomSheet>
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
