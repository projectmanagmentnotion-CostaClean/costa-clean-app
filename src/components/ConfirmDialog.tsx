import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP } from '../design-system/motion'
import { createMotionPreset, getReducedMotionSetVars } from '../design-system/motion/motionPresets'
import { useReducedMotion } from '../design-system/motion/useReducedMotion'

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
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

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

  useGSAP(() => {
    if (!isOpen || !overlayRef.current || !panelRef.current) return

    if (prefersReducedMotion) {
      gsap.set(overlayRef.current, { autoAlpha: 1 })
      gsap.set(panelRef.current, getReducedMotionSetVars())
      return
    }

    const overlayMotion = createMotionPreset('fadeIn', { duration: 0.18 })
    const panelMotion = createMotionPreset('modalEnter', { duration: 0.22, scale: 0.98, y: 8 })

    gsap.fromTo(overlayRef.current, overlayMotion.from, overlayMotion.to)
    gsap.fromTo(panelRef.current, panelMotion.from, panelMotion.to)
  }, { dependencies: [isOpen, prefersReducedMotion], scope: overlayRef, revertOnUpdate: true })

  if (!isOpen) return null

  const dialog = (
    <div ref={overlayRef} className="cc-confirm-dialog" role="presentation" onMouseDown={isBusy ? undefined : onCancel}>
      <div
        ref={panelRef}
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

  if (typeof document === 'undefined') {
    return dialog
  }

  return createPortal(dialog, document.body)
}
