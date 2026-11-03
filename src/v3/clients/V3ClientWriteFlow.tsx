import { useState } from 'react'
import { findClientDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { createClientRecord, updateClientRecord } from '../../features/clients/clientWriteApi'
import type { ClientListItem } from '../../features/clients/types'
import { V3DuplicateReviewSheet } from '../components/V3DuplicateReviewSheet'
import { V3ConfirmSheet, V3Field, V3Input, V3Textarea } from '../components/V3Primitives'
import { V3StepFlow } from '../stepflow/V3StepFlow'

type FormState = { full_name: string; phone: string; email: string; tax_id: string; billing_address: string }
const emptyForm: FormState = { full_name: '', phone: '', email: '', tax_id: '', billing_address: '' }

interface Props {
  existingClients: ClientListItem[]
  client?: ClientListItem | null
  onSaved: () => Promise<void>
  onCancel: () => void
  onOpenExisting: (id: string) => void
}

export function V3ClientWriteFlow({ existingClients, client = null, onSaved, onCancel, onOpenExisting }: Props) {
  const [form, setForm] = useState<FormState>(client ? { full_name: client.full_name, phone: client.phone ?? '', email: client.email ?? '', tax_id: client.tax_id ?? '', billing_address: client.billing_address ?? '' } : emptyForm)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<ReturnType<typeof findClientDuplicateGroups>>([])
  const update = (key: keyof FormState, value: string) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true) }
  const close = () => { if (dirty) setConfirmClose(true); else onCancel() }
  async function submit(skipReview = false) {
    setError(null)
    const draft = { id: client?.id ?? 'CLIENT-DRAFT', full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, tax_id: form.tax_id.trim() || null, billing_address: form.billing_address.trim() || null, status: client?.status ?? 'active', source_lead_id: client?.source_lead_id ?? null }
    if (!skipReview) {
      const groups = findClientDuplicateGroups(draft, existingClients.filter((item) => item.id !== client?.id))
      if (groups.length) { setDuplicates(groups); return }
    }
    setBusy(true)
    try {
      if (client) await updateClientRecord(client.id, draft)
      else await createClientRecord(draft)
      await onSaved(); setDirty(false); onCancel()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cliente.') } finally { setBusy(false) }
  }
  return <>
    <V3StepFlow title={client ? 'Editar cliente' : 'Nuevo cliente'} onCancel={close} onComplete={() => submit()} error={error} busy={busy} completeLabel="Guardar cliente" validateStep={(step) => step === 0 && !form.full_name.trim() ? 'Indica el nombre completo.' : null} steps={[
      { id: 'identity', title: 'Identidad', description: '¿A quién corresponde esta ficha?', content: <V3Field label="Nombre completo"><V3Input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} required autoFocus /></V3Field> },
      { id: 'contact', title: 'Contacto', description: 'Añade los canales que usarás para coordinar el servicio.', content: <><V3Field label="Teléfono"><V3Input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></V3Field><V3Field label="Email"><V3Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></V3Field></> },
      { id: 'billing', title: 'Datos fiscales', description: 'Información opcional para documentos y facturación.', content: <><V3Field label="NIF/CIF"><V3Input value={form.tax_id} onChange={(event) => update('tax_id', event.target.value)} /></V3Field><V3Field label="Dirección fiscal"><V3Textarea value={form.billing_address} onChange={(event) => update('billing_address', event.target.value)} /></V3Field></> },
    ]} />
    {confirmClose ? <V3ConfirmSheet title="Descartar cambios" description="Hay cambios sin guardar en esta ficha." confirmLabel="Descartar" onCancel={() => setConfirmClose(false)} onConfirm={onCancel} /> : null}
    {duplicates.length ? <V3DuplicateReviewSheet title="Posible cliente duplicado" description="Revisa la coincidencia antes de guardar otra ficha." groups={duplicates} onClose={() => setDuplicates([])} onOpenRecord={(id) => { setDuplicates([]); onOpenExisting(id) }} onContinueAnyway={() => { setDuplicates([]); void submit(true) }} /> : null}
  </>
}
