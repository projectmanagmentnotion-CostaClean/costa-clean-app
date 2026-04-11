import { useEffect, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'warning'
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    cancelButtonRef.current?.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
      previouslyFocusedElement?.focus()
    }
  }, [isBusy, isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="cc-confirm-dialog" role="presentation" onMouseDown={isBusy ? undefined : onCancel}>
      <div
        className={`cc-confirm-dialog__panel cc-confirm-dialog__panel--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-confirm-dialog-title"
        aria-describedby="cc-confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cc-confirm-dialog__content">
          <span className="cc-confirm-dialog__eyebrow">Confirmación</span>
          <h2 id="cc-confirm-dialog-title">{title}</h2>
          <div id="cc-confirm-dialog-description" className="cc-confirm-dialog__description">
            {description}
          </div>
        </div>

        <div className="cc-confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'warning' ? 'primary-button cc-confirm-dialog__confirm--warning' : 'primary-button'}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
