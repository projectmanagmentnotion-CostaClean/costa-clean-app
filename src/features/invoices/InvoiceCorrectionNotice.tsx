import { formatCurrency } from '../../app/displayFormat'
import { shareDocumentSummary } from '../documents/utils'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import {
  buildInvoiceCorrectionSummaryLines,
  getInvoiceCorrectionCase,
} from './invoiceCorrectionCases'
import type { InvoiceListItem } from './types'

interface InvoiceCorrectionNoticeProps {
  invoice: InvoiceListItem
  correctionPrefill?: InvoiceCreatePrefill | null
  onPrepareDraft?: (prefill: InvoiceCreatePrefill) => void
}

export function InvoiceCorrectionNotice({
  invoice,
  correctionPrefill = null,
  onPrepareDraft,
}: InvoiceCorrectionNoticeProps) {
  const resolvedCorrectionCase = getInvoiceCorrectionCase(invoice)
  if (!resolvedCorrectionCase) return null
  const correctionCase = resolvedCorrectionCase

  const currentLineTotal = correctionCase.currentQuantity * correctionCase.unitPrice
  const correctedLineTotal = correctionCase.correctedQuantity * correctionCase.unitPrice

  async function handleCopySummary() {
    await shareDocumentSummary(
      `Correccion segura ${correctionCase.invoiceNumber}`,
      buildInvoiceCorrectionSummaryLines(correctionCase),
      'Resumen de correccion copiado al portapapeles.',
      'No se pudo copiar el resumen de correccion.',
    )
  }

  return (
    <section className="data-section cc-invoice-detail-card__section cc-invoice-correction-notice">
      <div className="section-header page-header-actions">
        <div>
          <h2>Correccion segura pendiente</h2>
          <p>La emitida mantiene su trazabilidad. La correccion se prepara aparte y no reescribe esta factura.</p>
        </div>
      </div>

      <div className="cc-invoice-correction-notice__summary">
        <div className="cc-invoice-correction-notice__headline">
          <strong>Factura {correctionCase.invoiceNumber}</strong>
          <span>{correctionCase.targetConcept}</span>
        </div>
        <div className="cc-invoice-correction-notice__delta">
          <span>Diferencia total</span>
          <strong>+{formatCurrency(correctionCase.totalDifference)}</strong>
        </div>
      </div>

      <div className="cc-invoice-correction-notice__grid" aria-label="Comparativa de correccion">
        <article className="cc-invoice-correction-notice__card">
          <span>Actual</span>
          <strong>{correctionCase.currentQuantity} h</strong>
          <small>{formatCurrency(currentLineTotal)} en linea</small>
        </article>
        <article className="cc-invoice-correction-notice__card">
          <span>Corregido</span>
          <strong>{correctionCase.correctedQuantity} h</strong>
          <small>{formatCurrency(correctedLineTotal)} en linea</small>
        </article>
        <article className="cc-invoice-correction-notice__card">
          <span>Diferencia</span>
          <strong>+{correctionCase.correctedQuantity - correctionCase.currentQuantity} h</strong>
          <small>+{formatCurrency(correctionCase.baseDifference)} base</small>
        </article>
      </div>

      <div className="cc-invoice-correction-notice__totals">
        <span>Nueva base esperada: <strong>{formatCurrency(correctionCase.expectedSubtotal)}</strong></span>
        <span>Nuevo IVA esperado: <strong>{formatCurrency(correctionCase.expectedTaxAmount)}</strong></span>
        <span>Nuevo total esperado: <strong>{formatCurrency(correctionCase.expectedTotal)}</strong></span>
      </div>

      <div className="cc-invoice-correction-notice__actions">
        {correctionPrefill && onPrepareDraft ? (
          <button type="button" className="primary-button" onClick={() => onPrepareDraft(correctionPrefill)}>
            Preparar borrador guiado
          </button>
        ) : (
          <div className="cc-alert cc-alert--warning">
            <strong>Rectificativa o accion manual</strong>
            <p>Crea la rectificativa desde el flujo de facturas y usa estos importes. No edites la emitida directamente.</p>
          </div>
        )}

        <button type="button" className="secondary-button" onClick={() => void handleCopySummary()}>
          Copiar resumen
        </button>
      </div>
    </section>
  )
}
