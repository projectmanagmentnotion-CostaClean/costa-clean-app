import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addToastRecord, dismissToastRecord, updateToastRecord } from './toastState'
import { ToastContext } from './toastContext'
import type { ToastApi, ToastInput, ToastRecord, ToastUpdateInput } from './toastTypes'
import './toast.css'

interface ToastProviderProps {
  children: ReactNode
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  return (
    <article
      className={`cc-toast cc-toast--${toast.type}`}
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="cc-toast__copy">
        <strong>{toast.title}</strong>
        {toast.description ? <div className="cc-toast__description">{toast.description}</div> : null}
      </div>

      <div className="cc-toast__actions">
        {toast.action ? (
          <button
            type="button"
            className="cc-toast__action-button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
        <button
          type="button"
          className="cc-toast__close-button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      </div>
    </article>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="cc-toast-viewport" aria-label="Avisos globales">
      {toasts.map((toast) => (
        <ToastViewportItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastViewportItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    if (toast.persistent || (toast.durationMs ?? 0) <= 0 || typeof window === 'undefined') {
      return undefined
    }

    const timer = window.setTimeout(() => {
      onDismiss(toast.id)
    }, toast.durationMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [onDismiss, toast.durationMs, toast.id, toast.persistent])

  return <ToastItem toast={toast} onDismiss={onDismiss} />
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const show = useCallback((input: ToastInput) => {
    const generatedId = `toast-${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    setToasts((current) => addToastRecord(current, input, { id: generatedId }).toasts)
    return generatedId
  }, [])

  const update = useCallback((id: string, input: ToastUpdateInput) => {
    setToasts((current) => updateToastRecord(current, id, input))
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => dismissToastRecord(current, id))
  }, [])

  const api = useMemo<ToastApi>(() => ({
    show,
    update,
    dismiss,
    success: (title, description, options) => show({ type: 'success', title, description, ...options }),
    warning: (title, description, options) => show({ type: 'warning', title, description, ...options }),
    error: (title, description, options) => show({ type: 'error', title, description, ...options }),
    info: (title, description, options) => show({ type: 'info', title, description, ...options }),
    loading: (title, description, options) => show({ type: 'loading', title, description, persistent: true, ...options }),
  }), [dismiss, show, update])

  const viewport = (
    <ToastViewport
      toasts={toasts}
      onDismiss={dismiss}
    />
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document === 'undefined' ? viewport : createPortal(viewport, document.body)}
    </ToastContext.Provider>
  )
}
