import { buildInvoiceNumber, describeInvoiceNumberingGap, type InvoiceNumberingAudit } from './invoiceNumbering'

interface InvoiceNumberingControlCardProps {
  audit: InvoiceNumberingAudit
  onReviewSequence?: () => void
}

export function InvoiceNumberingControlCard({
  audit,
  onReviewSequence,
}: InvoiceNumberingControlCardProps) {
  const firstGapMessage = describeInvoiceNumberingGap(audit)

  return (
    <section className="data-section">
      <div className="section-header">
        <div>
          <h2>Control de numeracion</h2>
          <p>Lectura fiscal rapida para evitar saltos, duplicados y borradores con numero reservado.</p>
        </div>
        {onReviewSequence ? (
          <button type="button" className="secondary-button" onClick={onReviewSequence}>
            Revisar secuencia
          </button>
        ) : null}
      </div>

      <div className="cc-create-flow__summary-list">
        <div className="cc-create-flow__summary-item">
          <span>Ultimo numero emitido</span>
          <strong>{audit.lastIssuedInvoice?.invoice_number ?? 'Sin numeracion'}</strong>
        </div>
        <div className="cc-create-flow__summary-item">
          <span>Proximo sugerido</span>
          <strong>{audit.nextSuggestedInvoiceNumber}</strong>
        </div>
        <div className="cc-create-flow__summary-item">
          <span>Codigo interno sugerido</span>
          <strong>{audit.nextSuggestedDisplayCode}</strong>
        </div>
        <div className="cc-create-flow__summary-item">
          <span>Huecos detectados</span>
          <strong>{audit.gaps.length}</strong>
        </div>
        <div className="cc-create-flow__summary-item">
          <span>Duplicados detectados</span>
          <strong>{audit.duplicateInvoiceNumbers.length + audit.duplicateDisplayCodes.length}</strong>
        </div>
        <div className="cc-create-flow__summary-item">
          <span>Borradores con numero</span>
          <strong>{audit.draftsWithReservedNumbers.length}</strong>
        </div>
      </div>

      {firstGapMessage ? (
        <div className="cc-alert cc-alert--warning" style={{ marginTop: '1rem' }}>
          <strong>Revision de numeracion</strong>
          <p>{firstGapMessage} La siguiente factura no debe reutilizar esos huecos sin auditoria.</p>
        </div>
      ) : null}

      {audit.gaps.length > 0 ? (
        <p className="cc-create-flow__helper">
          Huecos: {audit.gaps.map((gap) => (
            gap.from === gap.to
              ? buildInvoiceNumber(audit.year, gap.from)
              : `${buildInvoiceNumber(audit.year, gap.from)} a ${buildInvoiceNumber(audit.year, gap.to)}`
          )).join(' | ')}
        </p>
      ) : null}

      {audit.draftsWithReservedNumbers.length > 0 ? (
        <p className="cc-create-flow__helper">
          Borradores con numero reservado: {audit.draftsWithReservedNumbers.map((invoice) => invoice.invoice_number ?? invoice.display_code ?? invoice.id).join(' | ')}
        </p>
      ) : null}

      {audit.outOfSyncEntries.length > 0 ? (
        <p className="cc-create-flow__helper">
          Codigos fuera de sincronizacion: {audit.outOfSyncEntries.map((invoice) => `${invoice.display_code ?? 'sin codigo'} / ${invoice.invoice_number ?? 'sin numero'}`).join(' | ')}
        </p>
      ) : null}
    </section>
  )
}
