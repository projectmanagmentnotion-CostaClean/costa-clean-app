import { useState, type FormEvent } from 'react'
import { findLeadDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { createLeadAuthenticated } from '../../features/leads/leadWriteApi'
import type { LeadListItem } from '../../features/leads/types'
import { V3DuplicateReviewSheet } from '../components/V3DuplicateReviewSheet'
import { V3BottomSheet, V3Field, V3Input, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'

interface Props {
  existingLeads: LeadListItem[]
  onCreated: () => Promise<void>
  onCancel: () => void
  onOpenExistingLead: (leadId: string) => void
  onDirtyChange: (dirty: boolean) => void
}

type FormState = {
  full_name: string
  phone: string
  email: string
  service_type: string
  property_type: string
  city: string
  postal_code: string
  notes: string
}

const initialForm: FormState = { full_name: '', phone: '', email: '', service_type: 'deep_cleaning', property_type: 'apartment', city: '', postal_code: '', notes: '' }

export function V3LeadCreateFlow({ existingLeads, onCreated, onCancel, onOpenExistingLead, onDirtyChange }: Props) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<ReturnType<typeof findLeadDuplicateGroups>>([])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    onDirtyChange(true)
  }

  async function submit(skipDuplicateReview = false) {
    setError(null)
    const draft = { id: 'LEAD-DRAFT', full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, city: form.city.trim() || null }
    if (!skipDuplicateReview) {
      const groups = findLeadDuplicateGroups(draft, existingLeads)
      if (groups.length) { setDuplicates(groups); return }
    }
    setBusy(true)
    try {
      const id = 'LEAD-' + (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now()))
      await createLeadAuthenticated({ id, full_name: draft.full_name, phone: draft.phone, email: draft.email, service_type: form.service_type, property_type: form.property_type || null, city: draft.city, postal_code: form.postal_code.trim() || null, notes: form.notes.trim() || null })
      await onCreated()
      onDirtyChange(false)
      onCancel()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el lead.')
    } finally {
      setBusy(false)
    }
  }

  return <V3BottomSheet title="Nuevo lead" onClose={onCancel}>
    <form className="v3-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit() }}>
      <V3Field label="Nombre completo"><V3Input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} required autoFocus /></V3Field>
      <V3Field label="Teléfono"><V3Input value={form.phone} onChange={(event) => update('phone', event.target.value)} required /></V3Field>
      <V3Field label="Email"><V3Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></V3Field>
      <V3Field label="Tipo de servicio"><V3Select value={form.service_type} onChange={(event) => update('service_type', event.target.value)}><option value="standard_cleaning">Limpieza estándar</option><option value="deep_cleaning">Limpieza profunda</option><option value="post_construction">Limpieza fin de obra</option><option value="check_out_cleaning">Limpieza check-out</option><option value="airbnb_turnover">Cambio Airbnb</option><option value="glass_cleaning">Limpieza de cristales</option></V3Select></V3Field>
      <V3Field label="Tipo de inmueble"><V3Select value={form.property_type} onChange={(event) => update('property_type', event.target.value)}><option value="apartment">Apartamento</option><option value="house">Casa</option><option value="office">Oficina</option><option value="local">Local</option><option value="tourist_apartment">Piso turístico</option><option value="community">Comunidad</option><option value="construction_site">Obra</option></V3Select></V3Field>
      <V3Field label="Ciudad"><V3Input value={form.city} onChange={(event) => update('city', event.target.value)} /></V3Field>
      <V3Field label="Código postal"><V3Input value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} /></V3Field>
      <V3Field label="Notas"><V3Textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></V3Field>
      {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
      <div className="v3-workspace-actions"><V3SecondaryAction onClick={onCancel}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar lead'}</V3PrimaryAction></div>
    </form>
    {duplicates.length ? <V3DuplicateReviewSheet title="Posible lead duplicado" description="Revisa la coincidencia antes de crear otro lead." groups={duplicates} onClose={() => setDuplicates([])} onOpenRecord={(id) => { setDuplicates([]); onOpenExistingLead(id) }} onContinueAnyway={() => { setDuplicates([]); void submit(true) }} /> : null}
  </V3BottomSheet>
}
