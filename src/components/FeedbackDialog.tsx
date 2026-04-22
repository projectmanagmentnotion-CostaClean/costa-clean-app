import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type FeedbackDialogTone = 'success' | 'error' | 'warning' | 'loading' | 'info'

interface FeedbackDialogProps {
  isOpen: boolean
  tone: FeedbackDialogTone
  title: string
  message: ReactNode
  actionLabel?: string
  onClose?: () => void
}

function getEyebrow(tone: FeedbackDialogTone): string {
  if (tone === 'success') return 'Operacion completada'
  if (tone === 'error') return 'No se pudo completar'
  if (tone === 'warning') return 'Atencion'
  if (tone === 'loading') return 'Procesando'
  return 'Informacion'
}

export function FeedbackDialog({
  isOpen,
  tone,
  title,
  message,
  actionLabel = 'Entendido',
  onClose,
}: FeedbackDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const canClose = tone !== 'loading' && Boolean(onClose)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    closeButtonRef.current?.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && canClose) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      previouslyFocusedElement?.focus()
    }
  }, [canClose, isOpen, onClose])

  if (!isOpen) return null

  const dialog = (
    <div
      className="cc-confirm-dialog cc-feedback-dialog"
      role="presentation"
      onMouseDown={canClose ? onClose : undefined}
    >
      <div
        className={`cc-confirm-dialog__panel cc-feedback-dialog__panel cc-feedback-dialog__panel--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-feedback-dialog-title"
        aria-describedby="cc-feedback-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cc-confirm-dialog__content">
          <span className="cc-confirm-dialog__eyebrow">{getEyebrow(tone)}</span>
          <h2 id="cc-feedback-dialog-title">{title}</h2>
          <div id="cc-feedback-dialog-description" className="cc-confirm-dialog__description">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        {canClose ? (
          <div className="cc-confirm-dialog__actions">
            <button
              ref={closeButtonRef}
              type="button"
              className="primary-button"
              onClick={onClose}
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return dialog
  }

  return createPortal(dialog, document.body)
}
