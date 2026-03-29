import { useEffect, useMemo, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CSSProperties } from 'react'
import type { QuoteListItem } from './types'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import { invoicePrintStyles } from '../invoices/invoicePrintStyles'
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

const frameWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: '0.9rem',
  display: 'flex',
}

const frameCardStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  borderRadius: '24px',
  overflow: 'hidden',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'linear-gradient(180deg, #0f1c2f 0%, #0b1626 100%)',
  boxShadow: '0 24px 64px rgba(2, 6, 23, 0.42)',
}

const iframeStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  background: '#0b1626',
}

const viewerScreenStyles = `
  html, body {
    margin: 0;
    padding: 0;
    background: #0b1626;
  }

  body {
    min-height: 100vh;
    overflow: auto;
  }

  .cc-print-root {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 24px 20px 40px;
    box-sizing: border-box;
  }

  @media (max-width: 900px) {
    .cc-print-root {
      padding: 16px 14px 28px;
    }
  }

  @media (max-width: 640px) {
    .cc-print-root {
      justify-content: flex-start;
      padding: 12px 12px 24px;
      overflow: auto;
    }

    .cc-invoice-a4--print {
      width: 210mm;
      min-width: 210mm;
      transform-origin: top left;
      zoom: 0.84;
    }
  }
`

export function QuoteDocumentScreen({
  quote,
  clients,
  properties,
  onClose,
}: QuoteDocumentScreenProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const documentTitle = useMemo(() => getQuoteDocumentTitle(quote, clients), [quote, clients])

  const documentHtml = useMemo(() => {
    const markup = renderToStaticMarkup(
      <QuoteDocumentA4
        quote={quote}
        clients={clients}
        properties={properties}
        variant="print"
      />,
    )

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${documentTitle}</title>
    <style>${invoicePrintStyles}\n${viewerScreenStyles}</style>
  </head>
  <body>
    <div class="cc-print-root">${markup}</div>
  </body>
</html>`
  }, [quote, clients, properties, documentTitle])

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
    const iframeWindow = iframeRef.current?.contentWindow
    const previousTitle = document.title

    document.title = documentTitle

    if (iframeWindow) {
      iframeWindow.focus()
      iframeWindow.print()

      window.setTimeout(() => {
        document.title = previousTitle
      }, 1500)

      return
    }

    window.setTimeout(() => {
      document.title = previousTitle
    }, 1500)

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
    <div style={overlayStyle}>
      <div style={topbarStyle}>
        <div style={titleWrapStyle}>
          <strong style={titleStyle}>Vista de presupuesto</strong>
          <span style={subtitleStyle}>
            {quote.display_code ?? quote.id}
          </span>
        </div>

        <div style={actionsStyle}>
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

      <div style={frameWrapStyle}>
        <div style={frameCardStyle}>
          <iframe
            ref={iframeRef}
            title={`Presupuesto ${quote.display_code ?? quote.id}`}
            srcDoc={documentHtml}
            style={iframeStyle}
          />
        </div>
      </div>
    </div>
  )
}