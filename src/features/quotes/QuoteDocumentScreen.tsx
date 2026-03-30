import type { CSSProperties } from 'react'
import { useEffect, useMemo } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import {
  getQuoteDocumentTitle,
  openQuotePrintWindow,
} from './openQuotePrintWindow'
import { shareDocumentSummary } from '../documents/utils'

interface QuoteDocumentScreenProps {
  quote: QuoteListItem
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onClose: () => void
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

export function QuoteDocumentScreen({
  quote,
  clients,
  properties,
  onClose,
}: QuoteDocumentScreenProps) {
  const documentTitle = useMemo(() => getQuoteDocumentTitle(quote, clients), [quote, clients])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [onClose])

  function handlePrint() {
    openQuotePrintWindow(quote, clients, properties, 'print')
  }

  function handleSavePdf() {
    openQuotePrintWindow(quote, clients, properties, 'pdf')
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${quote.total}`, `Estado: ${quote.status}`],
      'Resumen del presupuesto copiado al portapapeles.',
      'Compartir no está disponible en este dispositivo.',
    )
  }

  return (
    <div className="cc-document-screen" style={overlayStyle}>
      <div className="cc-document-screen__topbar" style={topbarStyle}>
        <div style={titleWrapStyle}>
          <strong style={titleStyle}>Vista de presupuesto</strong>
          <span style={subtitleStyle}>
            {quote.display_code ?? quote.id}
          </span>
        </div>

        <div className="cc-document-screen__actions" style={actionsStyle}>
          <button type="button" className="secondary-button" onClick={onClose}>
            <span style={iconLabelStyle}>
              <BackChevronIcon />
              Volver
            </span>
          </button>

          <button type="button" className="secondary-button" onClick={handleShare}>
            <span style={iconLabelStyle}>
              <IosShareIcon />
              Compartir
            </span>
          </button>

          <button type="button" className="secondary-button" onClick={handlePrint}>
            <span style={iconLabelStyle}>
              <PrintIcon />
              Imprimir
            </span>
          </button>

          <button type="button" className="primary-button" onClick={handleSavePdf}>
            <span style={iconLabelStyle}>
              <DownloadIcon />
              Guardar PDF
            </span>
          </button>
        </div>
      </div>

      <div className="cc-document-screen__content" style={contentStyle}>
        <div className="cc-document-screen__panel" style={panelStyle}>
          <div className="cc-document-screen__viewer" style={viewerCardStyle}>
            <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--quote cc-doc-preview-panel--screen">
              <div className="section-header">
                <h2>Vista previa de presupuesto</h2>
              </div>

              <div className="cc-doc-preview-panel__viewport">
                <div className="cc-doc-preview-panel__canvas">
                  <QuoteDocumentA4
                    quote={quote}
                    clients={clients}
                    properties={properties}
                    variant="embedded"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}


