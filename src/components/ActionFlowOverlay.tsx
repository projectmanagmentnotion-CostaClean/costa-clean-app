import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

  if (!isOpen) return null

  const overlay = (
    <div className="cc-action-flow" role="presentation">
      <div className="cc-action-flow__backdrop" />
      <section
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
