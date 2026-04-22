import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DocumentScreenFrameProps {
  title: string
  subtitle: string
  previewTitle: string
  previewClassName: string
  onClose: () => void
  onShare: () => void | Promise<void>
  onPrint: () => void
  onSavePdf: () => void
  isOutputDisabled?: boolean
  children: ReactNode
}

function BackChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M14.5 5.5 8 12l6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IosShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 15V4m0 0-3.5 3.5M12 4l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10.5H6a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  background: 'linear-gradient(180deg, #06111f 0%, #0b1728 100%)',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
}

const topbarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.85rem 1rem',
  background: 'rgba(8, 15, 28, 0.88)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
  backdropFilter: 'blur(16px)',
}

const titleWrapStyle: CSSProperties = {
  display: 'grid',
  gap: '0.12rem',
  minWidth: 0,
}

const titleStyle: CSSProperties = {
  display: 'block',
  fontSize: '1rem',
  color: '#f8fafc',
  letterSpacing: '-0.02em',
}

const subtitleStyle: CSSProperties = {
  fontSize: '0.88rem',
  color: '#94a3b8',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const contentStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'scroll',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  touchAction: 'pan-y',
  padding: '0.55rem 0.75rem 1rem',
}

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: '980px',
  margin: '0 auto',
  display: 'grid',
  gap: '0.5rem',
  minHeight: 'auto',
  alignContent: 'start',
}

const viewerCardStyle: CSSProperties = {
  borderRadius: '24px',
  overflow: 'visible',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'linear-gradient(180deg, #0f1c2f 0%, #0b1626 100%)',
  boxShadow: '0 24px 64px rgba(2, 6, 23, 0.42)',
  padding: '0.55rem',
}

const iconLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.45rem',
}

export function DocumentScreenFrame({
  title,
  subtitle,
  previewTitle,
  previewClassName,
  onClose,
  onShare,
  onPrint,
  onSavePdf,
  isOutputDisabled = false,
  children,
}: DocumentScreenFrameProps) {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [onClose])

  const screen = (
    <div className="cc-document-screen" style={overlayStyle}>
      <div className="cc-document-screen__topbar" style={topbarStyle}>
        <div className="cc-document-screen__title-wrap" style={titleWrapStyle}>
          <strong className="cc-document-screen__title" style={titleStyle}>{title}</strong>
          <span className="cc-document-screen__subtitle" style={subtitleStyle}>{subtitle}</span>
        </div>

        <div className="cc-document-screen__actions" style={actionsStyle}>
          <button type="button" className="secondary-button" onClick={onClose}>
            <span className="cc-document-screen__action-label" style={iconLabelStyle}>
              <BackChevronIcon />
              Volver
            </span>
          </button>

          <button type="button" className="secondary-button" onClick={onShare} disabled={isOutputDisabled}>
            <span className="cc-document-screen__action-label" style={iconLabelStyle}>
              <IosShareIcon />
              Compartir
            </span>
          </button>

          <button type="button" className="secondary-button" onClick={onPrint} disabled={isOutputDisabled}>
            <span className="cc-document-screen__action-label" style={iconLabelStyle}>
              <PrintIcon />
              Imprimir
            </span>
          </button>

          <button type="button" className="primary-button" onClick={onSavePdf} disabled={isOutputDisabled}>
            <span className="cc-document-screen__action-label" style={iconLabelStyle}>
              <DownloadIcon />
              Guardar
            </span>
          </button>
        </div>
      </div>

      <div className="cc-document-screen__content" style={contentStyle}>
        <div className="cc-document-screen__panel" style={panelStyle}>
          <div className="cc-document-screen__viewer" style={viewerCardStyle}>
            <section className={previewClassName}>
              <div className="section-header">
                <h2>{previewTitle}</h2>
              </div>

              <div className="cc-doc-preview-panel__viewport">
                <div className="cc-doc-preview-panel__canvas cc-doc-preview-panel__canvas--document">
                  {children}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return screen
  }

  return createPortal(screen, document.body)
}
