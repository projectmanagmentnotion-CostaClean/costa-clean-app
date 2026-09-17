import { useState, type FormEvent } from 'react'
import { formatCurrency, formatDateEs, getPaymentMethodLabel } from '../../app/displayFormat'
import { formatClientLabel, formatInvoiceLabel, formatPaymentLabel } from '../../app/relationshipLabels'
import { findPaymentDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { savePaymentAndRefreshInvoice } from '../../features/financial/financialWriteApi'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import { V3ActionGroup, V3DetailSection, V3EntityStatus, V3Field, V3Icon, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'
import { getPaymentProvenancePresentation } from './paymentPresentation'

interface V3PaymentWorkspaceProps {
  payment: PaymentListItem
  payments: PaymentListItem[]
  invoice: InvoiceListItem | null
  client: ClientListItem | null
  invoices: InvoiceListItem[]
  onBack: () => void
  onRefresh: () => Promise<void>
  onOpenInvoice: (invoiceId: string) => void
  onOpenClient: (clientId: string) => void
}

function parseAmount(value: string): number {
  const amount = Number(value.trim().replace(',', '.'))
  return Number.isFinite(amount) ? amount : Number.NaN
}

export function V3PaymentWorkspace(props: V3PaymentWorkspaceProps) {
  const { payment } = props
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    payment_date: payment.payment_date,
    amount: String(payment.amount),
    payment_method: payment.payment_method ?? 'transfer',
    notes: payment.notes ?? '',
  })
  const isManual = (payment.origin_type ?? 'manual') === 'manual'
  const provenance = getPaymentProvenancePresentation(payment.origin_type)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseAmount(form.amount)
    if (!form.payment_date || !Number.isFinite(amount) || amount <= 0) {
      setError('Indica una fecha y un importe válido mayor que cero.')
      return
    }
    const candidate: PaymentListItem = { ...payment, payment_date: form.payment_date, amount: Number(amount.toFixed(2)), payment_method: form.payment_method || null, notes: form.notes.trim() || null }
    if (findPaymentDuplicateGroups(candidate, props.payments).length > 0) {
      setError('Este cobro coincide con otro registro. Revisa factura, fecha, importe y método antes de guardar.')
      return
    }
    setSaving(true); setError(null); setMessage(null)
    try {
      await savePaymentAndRefreshInvoice({ id: payment.id, invoice_id: payment.invoice_id, payment_date: form.payment_date, amount: Number(amount.toFixed(2)), payment_method: form.payment_method || null, origin_type: payment.origin_type ?? 'manual', notes: form.notes.trim() || null })
      await props.onRefresh()
      setEditing(false)
      setMessage('Cobro actualizado correctamente.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el cobro.')
    } finally { setSaving(false) }
  }

  return (
    <V3Page className="v3-payment-workspace">
      <button type="button" className="v3-workspace-back" onClick={props.onBack}><V3Icon name="back" /> Cobros</button>
      <V3PageTitle eyebrow="Cobros" title={formatPaymentLabel(payment)} description={payment.notes ?? provenance.description} />
      <div className="v3-workspace-total"><strong>{formatCurrency(payment.amount)}</strong><span>Importe registrado · {formatDateEs(payment.payment_date)} · {getPaymentMethodLabel(payment.payment_method)}</span></div>
      <V3ActionGroup className="v3-finance-action-group">
        <V3PrimaryAction onClick={() => props.onOpenInvoice(payment.invoice_id)}>Ver factura</V3PrimaryAction>
        {isManual ? <V3SecondaryAction onClick={() => { setEditing((value) => !value); setError(null); setMessage(null) }}>{editing ? 'Cancelar edición' : 'Editar cobro'}</V3SecondaryAction> : null}
      </V3ActionGroup>
      {message ? <p className="v3-inline-message" role="status">{message}</p> : null}
      {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
      {editing && isManual ? (
        <form className="v3-form-grid" onSubmit={(event) => void save(event)}>
          <V3Field label="Fecha de cobro"><V3Input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} required /></V3Field>
          <V3Field label="Importe"><V3Input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></V3Field>
          <V3Field label="Método"><V3Select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="bizum">Bizum</option><option value="card">Tarjeta</option></V3Select></V3Field>
          <V3Field label="Notas"><V3Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></V3Field>
          <V3PrimaryAction type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</V3PrimaryAction>
        </form>
      ) : null}
      <V3DetailSection title="Procedencia"><dl className="v3-facts"><div><dt>Tipo de registro</dt><dd><V3EntityStatus label={provenance.label} tone="neutral" /></dd></div><div><dt>Estado financiero</dt><dd>No determina conciliación</dd></div></dl><p className="v3-section-copy">{provenance.description}</p></V3DetailSection>
      <V3DetailSection title="Relaciones"><dl className="v3-facts"><div><dt>Factura</dt><dd>{props.invoice ? formatInvoiceLabel(props.invoice) : 'Factura vinculada'}</dd></div><div><dt>Cliente</dt><dd>{props.client?.full_name ?? (props.invoice ? formatClientLabel(props.invoice) : 'Cliente no disponible')}</dd></div></dl><p className="v3-section-copy">{props.invoice ? `${formatCurrency(props.invoice.total)} · pendiente ${formatCurrency(props.invoice.outstanding_amount ?? props.invoice.total)}` : 'Factura vinculada no disponible en la carga actual.'}</p>{props.client ? <V3ActionGroup><V3SecondaryAction onClick={() => props.onOpenClient(props.client!.id)}>Abrir cliente</V3SecondaryAction></V3ActionGroup> : null}</V3DetailSection>
      <V3DetailSection title="Detalles"><dl className="v3-facts"><div><dt>Código</dt><dd>{formatPaymentLabel(payment)}</dd></div><div><dt>Fecha</dt><dd>{formatDateEs(payment.payment_date)}</dd></div><div><dt>Método</dt><dd>{getPaymentMethodLabel(payment.payment_method)}</dd></div></dl></V3DetailSection>
      <V3DetailSection title="Notas"><p className="v3-section-copy">{payment.notes ?? 'Sin notas registradas.'}</p></V3DetailSection>
    </V3Page>
  )
}
