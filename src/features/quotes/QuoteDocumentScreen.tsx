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

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  background: 'linear-gradient(180deg, #06111f 0%, #0b1728 100%)',
  display: 'flex',
  flexDirection: 'column',
}

const topbarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  gap: '0.9rem',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.9rem 1rem',
  background: 'rgba(8, 15, 28, 0.88)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
  backdropFilter: 'blur(16px)',
}

const titleWrapStyle: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
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
  overflow: 'auto',
  padding: '0.75rem 0.9rem 0.9rem',
}

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: '980px',
  margin: '0 auto',
  display: 'grid',
  gap: '0.75rem',
  alignContent: 'start',
}

const viewerCardStyle: CSSProperties = {
  borderRadius: '24px',
  overflow: 'hidden',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'linear-gradient(180deg, #0f1c2f 0%, #0b1626 100%)',
  boxShadow: '0 24px 64px rgba(2, 6, 23, 0.42)',
  padding: '0.75rem',
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

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
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
            Volver
          </button>

          <button type="button" className="secondary-button" onClick={handleShare}>
            Compartir
          </button>

          <button type="button" className="secondary-button" onClick={handlePrint}>
            Imprimir
          </button>

          <button type="button" className="primary-button" onClick={handleSavePdf}>
            Guardar PDF
          </button>
        </div>
      </div>

      <div className="cc-document-screen__content" style={contentStyle}>
        <div className="cc-document-screen__panel" style={panelStyle}>
          <div className="cc-document-screen__viewer" style={viewerCardStyle}>
            <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--quote cc-doc-preview-panel--screen">
              <div className="section-header">
                <h2>Vista previa de presupuesto</h2>
                <p>Previsualización rápida. Para verla a tamaño completo usa imprimir o guardar PDF.</p>
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