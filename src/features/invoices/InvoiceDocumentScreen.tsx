import { useEffect, useMemo, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import { invoicePrintStyles } from './invoicePrintStyles'
import {
  getInvoiceDocumentTitle,
  openInvoicePrintWindow,
} from './openInvoicePrintWindow'
import { shareDocumentSummary } from '../documents/utils'

interface InvoiceDocumentScreenProps {
  invoice: InvoiceListItem
  onClose: () => void
}

export function InvoiceDocumentScreen({
  invoice,
  onClose,
}: InvoiceDocumentScreenProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const documentTitle = useMemo(() => getInvoiceDocumentTitle(invoice), [invoice])

  const documentHtml = useMemo(() => {
    const markup = renderToStaticMarkup(<InvoiceDocumentA4 invoice={invoice} variant="print" />)

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${documentTitle}</title>
    <style>${invoicePrintStyles}</style>
  </head>
  <body>
    <div class="cc-print-root">${markup}</div>
  </body>
</html>`
  }, [invoice, documentTitle])

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

    openInvoicePrintWindow(invoice, 'print')
  }

  function handleSavePdf() {
    openInvoicePrintWindow(invoice, 'pdf')
  }

  async function handleShare() {
    await shareDocumentSummary(
      documentTitle,
      [`Total: ${invoice.total}`, `Estado: ${invoice.status}`],
      'Resumen de la factura copiado al portapapeles.',
      'Compartir no está disponible en este dispositivo.',
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: '#e9eef5',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          background: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid #dbe3ee',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div>
          <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>
            Documento de factura
          </strong>
          <span style={{ fontSize: '0.92rem', color: '#475569' }}>
            {invoice.invoice_number ?? invoice.display_code ?? invoice.id}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
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

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '1rem',
        }}
      >
        <iframe
          ref={iframeRef}
          title={`Factura ${invoice.invoice_number ?? invoice.display_code ?? invoice.id}`}
          srcDoc={documentHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '24px',
            background: '#e9eef5',
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.10)',
          }}
        />
      </div>
    </div>
  )
}
