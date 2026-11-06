import { useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import { saveInvoiceWithLines } from '../../features/financial/financialWriteApi'
import { canKeepInvoiceFiscalNumber, canSaveIssuedInvoiceCorrection } from '../../features/invoices/invoiceEditorIdentity'
import type { InvoiceListItem } from '../../features/invoices/types'
import {
  buildBillingLinePayloads,
  calculateBillingSubtotal,
  createBlankBillingLine,
  createLocalId,
  formatMoneyInput,
  type BillingLineFormState,
} from '../../features/shared/billingLineDrafts'
import { V3Field, V3Input, V3SecondaryAction, V3Textarea } from '../components/V3Primitives'
import { V3StepFlow } from '../stepflow/V3StepFlow'

interface Props {
  invoice: InvoiceListItem
  onRefreshData: () => Promise<void>
  onCompleted: () => Promise<void> | void
  onCancel: () => void
}

function initialLines(invoice: InvoiceListItem): BillingLineFormState[] {
  const source = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  return source.length > 0
    ? source.map((line) => ({
      local_id: line.id || createLocalId('LINE'),
      concept: line.concept,
      quantity: String(line.quantity),
      unit: line.unit ?? 'servicio',
      unit_price: String(line.unit_price),
    }))
    : [{ ...createBlankBillingLine(), concept: invoice.billing_concept ?? invoice.service_description ?? '' }]
}

export function V3InvoiceEditFlow({ invoice, onRefreshData, onCompleted, onCancel }: Props) {
  const [lines, setLines] = useState(() => initialLines(invoice))
  const [issueDate, setIssueDate] = useState(invoice.issue_date)
  const [notes, setNotes] = useState(invoice.notes ?? '')
  const [internalCorrectionConfirmed, setInternalCorrectionConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const subtotal = useMemo(() => calculateBillingSubtotal(lines), [lines])
  const tax = Math.round(subtotal * businessRules.defaultTaxRate * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  const paid = Number(invoice.paid_amount ?? Math.max(
    Number(invoice.total ?? 0) - Number(invoice.outstanding_amount ?? invoice.total ?? 0),
    0,
  ))
  const locked = invoice.status === 'paid' || invoice.payment_status === 'paid' || invoice.status === 'cancelled'

  function updateLine(index: number, field: keyof BillingLineFormState, value: string) {
    setLines((current) => current.map((line, itemIndex) => (
      itemIndex === index ? { ...line, [field]: value } : line
    )))
  }

  async function submit() {
    setError(null)
    if (locked) return setError('Esta factura no admite edición por su estado financiero.')
    if (!canSaveIssuedInvoiceCorrection(invoice.status, internalCorrectionConfirmed)) {
      return setError('Confirma que la factura emitida no se ha enviado y puede corregirse internamente.')
    }
    if (invoice.status === 'issued' && !canKeepInvoiceFiscalNumber(invoice.invoice_number, issueDate)) {
      return setError('La fecha debe permanecer en el ejercicio de su número fiscal. Para otro ejercicio, prepara una factura rectificativa.')
    }
    if (total + 0.009 < paid) return setError(`El total no puede ser inferior a lo ya cobrado (${paid.toFixed(2)} €).`)
    const payloadLines = buildBillingLinePayloads(lines, (concept) => concept.trim())
    if (!payloadLines?.length) return setError('Añade al menos una línea válida.')

    setBusy(true)
    try {
      await saveInvoiceWithLines({
        id: invoice.id,
        job_id: invoice.job_id ?? null,
        quote_id: invoice.quote_id ?? null,
        client_id: invoice.client_id,
        property_id: invoice.property_id ?? null,
        service_reference_override: invoice.service_reference_override ?? null,
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

  return <V3StepFlow
    title={`Editar ${invoice.invoice_number ?? invoice.display_code ?? 'factura'}`}
    onCancel={onCancel}
    onComplete={submit}
    error={error}
    busy={busy || locked}
    completeLabel="Guardar cambios"
    validateStep={(step) => {
      if (step === 0 && !issueDate) return 'Indica la fecha.'
      if (step === 0 && invoice.status === 'issued' && !internalCorrectionConfirmed) return 'Confirma la corrección interna antes de continuar.'
      if (step === 1 && !buildBillingLinePayloads(lines, (concept) => concept.trim())?.length) return 'Añade una línea válida.'
      return null
    }}
    steps={[
      { id: 'date', title: 'Fecha', description: 'Conserva la identidad y relaciones de la factura.', content: <>
        {invoice.status === 'issued' ? <div className="v3-state" role="note"><strong>Factura emitida en revisión</strong><p>Si ya se envió o necesita rectificación fiscal, no uses esta corrección interna.</p></div> : null}
        <V3Field label="Fecha"><V3Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={locked} required autoFocus /></V3Field>
        {invoice.status === 'issued' ? <label className="v3-section-copy"><input type="checkbox" checked={internalCorrectionConfirmed} onChange={(event) => setInternalCorrectionConfirmed(event.target.checked)} disabled={locked} /> Confirmo que esta factura no se ha enviado y puede corregirse internamente manteniendo el número.</label> : null}
      </> },
      { id: 'lines', title: 'Líneas', description: 'Ajusta los conceptos permitidos.', content: <>
        {lines.map((line, index) => <div className="v3-step-flow__line" key={line.local_id}>
          <V3Field label="Concepto"><V3Input value={line.concept} onChange={(event) => updateLine(index, 'concept', event.target.value)} disabled={locked} required /></V3Field>
          <V3Field label="Cantidad"><V3Input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} disabled={locked} required /></V3Field>
          <V3Field label="Unidad"><V3Input value={line.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} disabled={locked} required /></V3Field>
          <V3Field label="Precio unitario"><V3Input inputMode="decimal" value={line.unit_price} onChange={(event) => updateLine(index, 'unit_price', event.target.value)} disabled={locked} required /></V3Field>
        </div>)}
        {!locked ? <V3SecondaryAction onClick={() => setLines((current) => [...current, createBlankBillingLine()])}>Añadir línea</V3SecondaryAction> : null}
      </> },
      { id: 'review', title: 'Revisión', description: 'Confirma el resultado antes de guardar.', content: <>
        <p className="v3-inline-message">Base {formatMoneyInput(subtotal)} € · IVA {formatMoneyInput(tax)} € · Total {formatMoneyInput(total)} € · Cobrado {formatMoneyInput(paid)} €</p>
        <V3Field label="Notas"><V3Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={locked} /></V3Field>
        {locked ? <p className="v3-inline-message">Edición bloqueada para preservar el historial.</p> : null}
      </> },
    ]}
  />
}
