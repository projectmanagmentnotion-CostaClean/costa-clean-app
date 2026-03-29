import type { CSSProperties } from 'react'
import { useEffect, useMemo } from 'react'
import type { InvoiceListItem } from './types'
import { InvoiceDocumentA4 } from './InvoiceDocumentA4'
import {
  getInvoiceDocumentTitle,
  openInvoicePrintWindow,
} from './openInvoicePrintWindow'
import { shareDocumentSummary } from '../documents/utils'

interface InvoiceDocumentScreenProps {
  invoice: InvoiceListItem
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
  gap: '0',
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


export function InvoiceDocumentScreen({
  invoice,
  onClose,
}: InvoiceDocumentScreenProps) {
  const documentTitle = useMemo(() => getInvoiceDocumentTitle(invoice), [invoice])

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
    <div style={overlayStyle}>
      <div style={topbarStyle}>
        <div style={titleWrapStyle}>
          <strong style={titleStyle}>Vista de factura</strong>
          <span style={subtitleStyle}>
            {invoice.invoice_number ?? invoice.display_code ?? invoice.id}
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

      <div style={contentStyle}>
        <div style={panelStyle}>
          <div style={viewerCardStyle}>
            <section className="data-section cc-doc-preview-panel cc-doc-preview-panel--invoice cc-doc-preview-panel--screen">
              <div className="section-header">
                <h2>Vista previa de factura</h2>
                <p>Previsualización rápida. Para verla a tamaño completo usa imprimir o guardar PDF.</p>
              </div>

              <div className="cc-doc-preview-panel__viewport">
                <div className="cc-doc-preview-panel__canvas">
                  <InvoiceDocumentA4 invoice={invoice} variant="embedded" />
                </div>
              </div>
            </section>
          </div>
</div>
      </div>
    </div>
  )
}