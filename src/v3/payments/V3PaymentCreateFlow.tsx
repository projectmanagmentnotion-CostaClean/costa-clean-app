import { useMemo, useState } from 'react'
import { findPaymentDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { savePaymentAndRefreshInvoice } from '../../features/financial/financialWriteApi'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import { V3BottomSheet, V3Field, V3Input, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'

interface Props {
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  payments: PaymentListItem[]
  onRefreshData: () => Promise<void>
  onCompleted: () => Promise<void> | void
  onCancel: () => void
  onOpenExistingPayment?: (paymentId: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

function todayLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function decimal(value: string) {
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function V3PaymentCreateFlow({ invoices, clients, payments, onRefreshData, onCompleted, onCancel, onOpenExistingPayment, onDirtyChange }: Props) {
  const availableInvoices = useMemo(() => invoices.filter((invoice) => Number(invoice.outstanding_amount ?? invoice.total) > 0.009), [invoices])
  const [invoiceId, setInvoiceId] = useState(availableInvoices[0]?.id ?? '')
  const [paymentDate, setPaymentDate] = useState(todayLocalDate())
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('transfer')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const invoice = invoices.find((item) => item.id === invoiceId) ?? null
  const client = clients.find((item) => item.id === invoice?.client_id) ?? null
  const outstanding = Number(invoice?.outstanding_amount ?? invoice?.total ?? 0)

  function dirty() { onDirtyChange?.(true) }
  function syncAmount() { setAmount(outstanding > 0 ? outstanding.toFixed(2) : ''); dirty() }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsedAmount = decimal(amount)
    if (!invoice) return setError('Selecciona una factura pendiente.')
    if (!paymentDate) return setError('Indica la fecha de cobro.')
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError('El importe debe ser mayor que cero.')
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? `PAYMENT-${crypto.randomUUID()}` : `PAYMENT-${Date.now()}`
    const candidate = { id, display_code: null, invoice_id: invoice.id, invoice_display_code: invoice.display_code ?? null, invoice_number: invoice.invoice_number ?? null, payment_date: paymentDate, created_at: null, amount: Number(parsedAmount.toFixed(2)), payment_method: method || null, origin_type: 'manual' as const, notes: notes.trim() || null }
    const duplicates = findPaymentDuplicateGroups(candidate, payments)
    if (duplicates.length > 0) { setDuplicateId(duplicates[0]?.records?.[0]?.recordId ?? null); return }
    setBusy(true)
    try {
      await savePaymentAndRefreshInvoice({ id, invoice_id: invoice.id, payment_date: paymentDate, amount: Number(parsedAmount.toFixed(2)), payment_method: method || null, origin_type: 'manual', notes: notes.trim() || null })
      onDirtyChange?.(false)
      await onRefreshData()
      await onCompleted()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo registrar el cobro.') } finally { setBusy(false) }
  }

  return <V3BottomSheet title="Registrar cobro" onClose={onCancel}><form className="v3-form" onSubmit={(event) => void submit(event)}><p className="v3-section-copy">Factura → importe → revisión. El registro actualiza la relación financiera real.</p><V3Field label="Factura"><V3Select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); dirty() }} required><option value="">Selecciona una factura</option>{availableInvoices.map((item) => <option key={item.id} value={item.id}>{item.display_code ?? item.invoice_number ?? item.id} · {clients.find((candidate) => candidate.id === item.client_id)?.full_name ?? 'Cliente'}</option>)}</V3Select></V3Field><V3Field label="Cliente"><V3Input value={client?.full_name ?? 'Se resolverá desde la factura'} readOnly /></V3Field><div className="v3-form-grid"><V3Field label="Fecha"><V3Input type="date" value={paymentDate} onChange={(event) => { setPaymentDate(event.target.value); dirty() }} required /></V3Field><V3Field label="Método"><V3Select value={method} onChange={(event) => { setMethod(event.target.value); dirty() }}><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="bizum">Bizum</option><option value="card">Tarjeta</option></V3Select></V3Field></div><V3Field label="Importe"><div className="v3-inline-field"><V3Input inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); dirty() }} placeholder="0,00" required /><V3SecondaryAction type="button" onClick={syncAmount} disabled={!invoice}>Usar pendiente</V3SecondaryAction></div></V3Field><V3Field label="Notas"><V3Textarea value={notes} onChange={(event) => { setNotes(event.target.value); dirty() }} /></V3Field>{invoice ? <p className="v3-inline-message">Pendiente actual: {outstanding.toFixed(2)} €</p> : null}{error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}{duplicateId && onOpenExistingPayment ? <V3SecondaryAction type="button" onClick={() => onOpenExistingPayment(duplicateId)}>Abrir cobro existente</V3SecondaryAction> : null}<div className="v3-workspace-actions"><V3SecondaryAction type="button" onClick={onCancel}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Registrar cobro'}</V3PrimaryAction></div></form></V3BottomSheet>
}
