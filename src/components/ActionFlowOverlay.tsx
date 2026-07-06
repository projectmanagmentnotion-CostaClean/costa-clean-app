import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gsap, useGSAP } from '../design-system/motion'
import { createMotionPreset, getReducedMotionSetVars } from '../design-system/motion/motionPresets'
import { useReducedMotion } from '../design-system/motion/useReducedMotion'
import './action-flow-overlay.css'

interface ActionFlowOverlayProps {
  isOpen: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}

export function ActionFlowOverlay({
  isOpen,
  title,
  description,
  onClose,
  children,
}: ActionFlowOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useGSAP(() => {
    if (!isOpen || !overlayRef.current || !backdropRef.current || !panelRef.current) return

    if (prefersReducedMotion) {
      gsap.set(backdropRef.current, { autoAlpha: 1 })
      gsap.set(panelRef.current, getReducedMotionSetVars())
      return
    }

    const backdropMotion = createMotionPreset('fadeIn', { duration: 0.18 })
    const panelMotion = createMotionPreset('sheetEnter', { duration: 0.24, y: 18 })

    gsap.fromTo(backdropRef.current, backdropMotion.from, backdropMotion.to)
    gsap.fromTo(panelRef.current, panelMotion.from, panelMotion.to)
  }, { dependencies: [isOpen, prefersReducedMotion], scope: overlayRef, revertOnUpdate: true })

  if (!isOpen) return null

  const overlay = (
    <div ref={overlayRef} className="cc-action-flow" role="presentation">
      <div ref={backdropRef} className="cc-action-flow__backdrop" />
      <section
        ref={panelRef}
        className="cc-action-flow__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-action-flow-title"
        aria-describedby="cc-action-flow-description"
      >
        <header className="cc-action-flow__topbar">
          <div className="cc-action-flow__copy">
            <span className="cc-action-flow__eyebrow">Accion guiada</span>
            <h2 id="cc-action-flow-title">{title}</h2>
            <p id="cc-action-flow-description">{description}</p>
          </div>

          <button type="button" className="secondary-button cc-action-flow__dismiss" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="cc-action-flow__body">
          {children}
        </div>

        <div className="cc-action-flow__footer">
          <button type="button" className="secondary-button cc-action-flow__dismiss cc-action-flow__dismiss--footer" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
