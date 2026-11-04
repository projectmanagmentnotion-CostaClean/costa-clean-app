import { useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { saveInvoiceWithLines } from '../../features/financial/financialWriteApi'
import { canSaveIssuedInvoiceCorrection } from '../../features/invoices/invoiceEditorIdentity'
import type { InvoiceListItem } from '../../features/invoices/types'
import {
  buildBillingLinePayloads,
  calculateBillingSubtotal,
  createBlankBillingLine,
  createLocalId,
  formatMoneyInput,
  type BillingLineFormState,
} from '../../features/shared/billingLineDrafts'
import {
  V3BottomSheet,
  V3EntityStatus,
  V3Field,
  V3Input,
  V3PrimaryAction,
  V3SecondaryAction,
  V3Textarea,
} from '../components/V3Primitives'

interface Props {
  invoice: InvoiceListItem
  onRefreshData: () => Promise<void>
  onCompleted: () => Promise<void> | void
  onCancel: () => void
}

function initialLines(invoice: InvoiceListItem): BillingLineFormState[] {
  const source = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  if (source.length > 0) {
    return source.map((line) => ({
      local_id: line.id || createLocalId('LINE'),
      concept: line.concept,
      quantity: String(line.quantity),
      unit: line.unit ?? 'servicio',
      unit_price: String(line.unit_price),
    }))
  }

  return [{
    ...createBlankBillingLine(),
    concept: invoice.billing_concept ?? invoice.service_description ?? '',
  }]
}

export function V3InvoiceEditFlow({ invoice, onRefreshData, onCompleted, onCancel }: Props) {
  const [lines, setLines] = useState(() => initialLines(invoice))
  const [issueDate, setIssueDate] = useState(invoice.issue_date)
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [internalCorrectionConfirmed, setInternalCorrectionConfirmed] = useState(false)
  const subtotal = useMemo(() => calculateBillingSubtotal(lines), [lines])
  const tax = useMemo(() => Math.round(subtotal * businessRules.defaultTaxRate * 100) / 100, [subtotal])
  const total = Math.round((subtotal + tax) * 100) / 100
  const paid = Number(invoice.paid_amount ?? Math.max(
    Number(invoice.total ?? 0) - Number(invoice.outstanding_amount ?? invoice.total ?? 0),
    0,
  ))
  const locked = invoice.status === 'paid'
    || invoice.payment_status === 'paid'
    || invoice.status === 'cancelled'

  function updateLine(index: number, field: keyof BillingLineFormState, value: string) {
    setLines((current) => current.map((line, itemIndex) => (
      itemIndex === index ? { ...line, [field]: value } : line
    )))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (locked) {
      setError('Esta factura no admite edición por su estado financiero.')
      return
    }
    if (!canSaveIssuedInvoiceCorrection(invoice.status, internalCorrectionConfirmed)) {
      setError('Confirma que la factura emitida no se ha enviado y puede corregirse internamente.')
      return
    }
    if (total + 0.009 < paid) {
      setError(`El total no puede ser inferior a lo ya cobrado (${paid.toFixed(2)} €).`)
      return
    }

    const payloadLines = buildBillingLinePayloads(lines, (concept) => concept.trim())
    if (!payloadLines?.length) {
      setError('Añade al menos una línea válida.')
      return
    }

    setBusy(true)
    try {
      await saveInvoiceWithLines({
        id: invoice.id,
        job_id: invoice.job_id ?? null,
        quote_id: invoice.quote_id ?? null,
        client_id: invoice.client_id,
        property_id: invoice.property_id ?? null,
        issue_date: issueDate,
        status: invoice.status,
        subtotal,
        tax_amount: tax,
        total,
        notes: notes.trim() || null,
        internal_notes: invoice.internal_notes ?? null,
        pricing_metadata: invoice.pricing_metadata ?? null,
      }, payloadLines.map((line, index) => ({
        ...line,
        id: createLocalId('INVOICE-LINE'),
        invoice_id: invoice.id,
        sort_order: index,
      })))
      await onRefreshData()
      await onCompleted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la factura.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <V3BottomSheet title={`Editar ${invoice.invoice_number ?? invoice.display_code ?? 'factura'}`} onClose={onCancel}>
      <form className="v3-form" onSubmit={(event) => void submit(event)}>
        <p className="v3-section-copy">
          La identidad, numeración, relaciones y estado financiero se conservan. Solo se editan datos permitidos.
        </p>
        {locked ? <p className="v3-inline-message">Edición bloqueada para preservar el historial de esta factura.</p> : null}
        {invoice.status === 'issued' ? (
          <>
            <div className="v3-state" role="note">
              <V3EntityStatus label="Factura emitida en revisión" tone="warning" />
              <p>Si ya se envió o la rectificación fiscal es necesaria, no uses esta corrección interna.</p>
            </div>
            <label className="v3-section-copy">
              <input
                type="checkbox"
                checked={internalCorrectionConfirmed}
                onChange={(event) => setInternalCorrectionConfirmed(event.target.checked)}
                disabled={locked}
              />{' '}
              Confirmo que esta factura no se ha enviado y puede corregirse internamente manteniendo el número.
            </label>
          </>
        ) : null}
        <V3Field label="Fecha">
          <V3Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={locked} required />
        </V3Field>
        {lines.map((line, index) => (
          <div className="v3-form-grid" key={line.local_id}>
            <V3Field label="Concepto">
              <V3Input value={line.concept} onChange={(event) => updateLine(index, 'concept', event.target.value)} disabled={locked} required />
            </V3Field>
            <V3Field label="Cantidad">
              <V3Input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} disabled={locked} required />
            </V3Field>
            <V3Field label="Unidad">
              <V3Input value={line.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} disabled={locked} required />
            </V3Field>
            <V3Field label="Precio unitario">
              <V3Input inputMode="decimal" value={line.unit_price} onChange={(event) => updateLine(index, 'unit_price', event.target.value)} disabled={locked} required />
            </V3Field>
          </div>
        ))}
        {!locked ? <V3SecondaryAction type="button" onClick={() => setLines((current) => [...current, createBlankBillingLine()])}>Añadir línea</V3SecondaryAction> : null}
        <V3Field label="Notas">
          <V3Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={locked} />
        </V3Field>
        <p className="v3-inline-message">Base {formatMoneyInput(subtotal)} € · IVA {formatMoneyInput(tax)} € · Total {formatMoneyInput(total)} € · Cobrado {formatMoneyInput(paid)} €</p>
        {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
        <div className="v3-workspace-actions">
          <V3SecondaryAction type="button" onClick={onCancel}>Cancelar</V3SecondaryAction>
          {!locked ? <V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</V3PrimaryAction> : null}
        </div>
      </form>
    </V3BottomSheet>
  )
}
