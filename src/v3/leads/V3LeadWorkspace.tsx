import { useEffect, useState } from 'react'
import { formatCurrency, formatDateEs, getPropertyTypeLabel, getServiceTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import { isForbiddenServiceRequested } from '../../config/leadQuoteMessagingEngineAccess'
import type { ClientListItem } from '../../features/clients/types'
import { convertLeadToClient } from '../../features/financial/financialWriteApi'
import { regenerateLeadDraftMessages } from '../../features/leadDrafts/leadDraftMessagingApi'
import { convertReviewedLeadDraftToQuote, createOrLinkClientFromReviewedLeadDraft, markLeadDraftReviewed } from '../../features/leadDrafts/leadDraftConversion'
import type { LeadDraftRecord } from '../../features/leadDrafts/types'
import { updateLeadAuthenticated } from '../../features/leads/leadWriteApi'
import type { LeadListItem } from '../../features/leads/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { buildMailtoUrl, buildWhatsAppUrl } from '../clients/contactActions'
import { V3ContactActions } from '../clients/V3ContactActions'
import { V3BottomSheet, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Status, V3Textarea } from '../components/V3Primitives'

interface V3LeadWorkspaceProps {
  lead: LeadListItem
  draft: LeadDraftRecord | null
  quotes: QuoteListItem[]
  client: ClientListItem | null
  onBack: () => void
  onRefresh: () => Promise<void>
  onOpenQuote: (quoteId: string) => void
  onOpenClient: (clientId: string) => void
}

function draftPricing(draft: LeadDraftRecord) {
  return draft.pricing_breakdown ?? draft.quote_draft_seed.pricingBreakdown ?? null
}

function draftMessage(draft: LeadDraftRecord): string {
  return draft.ai_whatsapp_draft?.trim() || `Hola ${draft.suggested_full_name}, te escribimos de Costa Clean.`
}

export function V3LeadWorkspace({ lead, draft, quotes, client, onBack, onRefresh, onOpenQuote, onOpenClient }: V3LeadWorkspaceProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: lead.full_name, phone: lead.phone, city: lead.city ?? '', status: lead.status })
  const pricing = draft ? draftPricing(draft) : null
  const reviewed = draft?.ai_draft_status === 'reviewed'
  const canConvertDraft = Boolean(draft && reviewed && pricing && !isForbiddenServiceRequested(draft.normalized_input) && ['matched_existing_lead', 'ready_for_review', 'converted'].includes(draft.status))
  const draftWhatsApp = draft ? buildWhatsAppUrl(draft.phone, { text: draftMessage(draft) }) : null
  const draftEmail = draft ? buildMailtoUrl(draft.email, { subject: `Costa Clean · ${draft.suggested_full_name}`, body: draft.ai_email_draft ?? draftMessage(draft) }) : null

  useEffect(() => {
    setForm({ full_name: lead.full_name, phone: lead.phone, city: lead.city ?? '', status: lead.status })
  }, [lead])

  const primaryLabel = client ? 'Ver cliente' : quotes.length > 0 && reviewed ? 'Crear o vincular cliente' : draft && !reviewed ? 'Revisar borrador' : canConvertDraft ? 'Crear presupuesto' : 'Convertir a cliente'

  async function run(action: () => Promise<void>, success: string) {
    setIsBusy(true)
    setFeedback(null)
    try {
      await action()
      await onRefresh()
      setFeedback(success)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo completar la acción.')
    } finally {
      setIsBusy(false)
    }
  }

  function runPrimary() {
    if (client) return onOpenClient(client.id)
    if (draft && !reviewed) return void run(async () => { await markLeadDraftReviewed(draft.id) }, 'Borrador marcado como revisado.')
    if (draft && canConvertDraft && quotes.length === 0) return void run(async () => { const result = await convertReviewedLeadDraftToQuote(lead, draft); onOpenQuote(result.quoteId) }, 'Presupuesto creado desde el borrador.')
    return void run(async () => { const clientId = draft ? (await createOrLinkClientFromReviewedLeadDraft(lead, draft)).clientId : (await convertLeadToClient(lead.id)).client_id; onOpenClient(clientId) }, 'Cliente creado o vinculado.')
  }

  function saveEdit() {
    void run(async () => {
      await updateLeadAuthenticated(lead.id, { full_name: form.full_name.trim(), phone: form.phone.trim(), city: form.city.trim() || null, status: form.status })
      setIsEditOpen(false)
    }, 'Lead actualizado.')
  }

  function toggleArchive() {
    const nextArchived = !lead.archived_at
    if (nextArchived && !window.confirm('¿Archivar este lead? No se borrará y podrás restaurarlo después.')) return
    void run(async () => { await updateLeadAuthenticated(lead.id, { archived_at: nextArchived ? new Date().toISOString() : null }) }, nextArchived ? 'Lead archivado.' : 'Lead restaurado.')
  }

  return <V3Page className="v3-lead-workspace">
    <button type="button" className="v3-workspace-back" onClick={onBack}>← Leads</button>
    <V3PageTitle eyebrow="Workspace comercial" title={lead.full_name} description={`${lead.display_code ?? lead.id} · ${lead.city ?? 'Sin ciudad'}`} />
    <div className="v3-lead-workspace__status"><V3Status label={lead.archived_at ? 'Archivado' : getStatusLabel(lead.status)} tone={lead.archived_at ? 'neutral' : lead.status === 'won' ? 'success' : lead.status === 'lost' ? 'danger' : 'warning'} /><span>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</span></div>
    <div className="v3-workspace-actions"><V3ContactActions phone={lead.phone} email={lead.email} clientName={lead.full_name} /><V3PrimaryAction onClick={runPrimary} disabled={isBusy || Boolean(lead.archived_at && !client)}>{primaryLabel}</V3PrimaryAction></div>
    {feedback ? <div className="v3-state" role="status"><strong>{feedback}</strong></div> : null}
    <V3Section label="Solicitud / intake">
      {draft ? <dl className="v3-facts"><div><dt>Servicio</dt><dd>{getServiceTypeLabel(draft.normalized_input.serviceNeedLabel)}</dd></div><div><dt>Inmueble</dt><dd>{getPropertyTypeLabel(draft.normalized_input.propertyType)}</dd></div><div><dt>Ciudad</dt><dd>{draft.city ?? 'Sin ciudad'}</dd></div><div><dt>Fecha</dt><dd>{formatDateEs(draft.normalized_input.requestedServiceDate)}</dd></div><div><dt>Horario</dt><dd>{draft.normalized_input.preferredTimeSlot ?? 'Flexible'}</dd></div></dl> : <p className="v3-section-copy">Sin intake relacionado.</p>}
    </V3Section>
    <V3Section label="Borrador">
      {draft ? (
        <>
          <div className="v3-lead-draft-state">
            <V3Status label={reviewed ? 'Borrador revisado' : 'Pendiente de revisión'} tone={reviewed ? 'success' : 'warning'} />
            <span>{draft.ai_email_draft || draft.ai_whatsapp_draft ? 'Borradores disponibles' : 'Sin mensaje generado'}</span>
          </div>
          {pricing ? (
            <dl className="v3-facts">
              <div><dt>Horas</dt><dd>{pricing.totalHours ?? '—'}</dd></div>
              <div><dt>Operarios</dt><dd>{pricing.operators ?? '—'}</dd></div>
              <div><dt>Subtotal</dt><dd>{formatCurrency(pricing.subtotal)}</dd></div>
              <div><dt>IVA</dt><dd>{formatCurrency(pricing.taxAmount)}</dd></div>
              <div><dt>Total</dt><dd>{formatCurrency(pricing.total)}</dd></div>
            </dl>
          ) : null}
          <div className="v3-workspace-actions">
            {!reviewed ? <V3PrimaryAction onClick={() => void run(async () => { await markLeadDraftReviewed(draft.id) }, 'Borrador marcado como revisado.')} disabled={isBusy}>Revisar borrador</V3PrimaryAction> : null}
            {reviewed && draftWhatsApp ? <a className="v3-contact-action" href={draftWhatsApp} target="_blank" rel="noreferrer">Abrir borrador WhatsApp</a> : null}
            {reviewed && draftEmail ? <a className="v3-contact-action" href={draftEmail}>Abrir borrador email</a> : null}
            {reviewed ? <V3SecondaryAction onClick={() => { void navigator.clipboard?.writeText(draftMessage(draft)) }} disabled={isBusy}>Copiar mensaje</V3SecondaryAction> : null}
          </div>
        </>
      ) : <p className="v3-section-copy">No hay borrador asociado.</p>}
    </V3Section>
    <V3Section label="Presupuestos">{quotes.length ? <div className="v3-relation-list">{quotes.map((quote) => <button key={quote.id} type="button" className="v3-relation-row" onClick={() => onOpenQuote(quote.id)}><span><strong>{quote.display_code ?? quote.id}</strong><small>{formatCurrency(quote.total)} · {getStatusLabel(quote.status)}</small></span><span aria-hidden="true">→</span></button>)}</div> : <p className="v3-section-copy">Sin presupuestos relacionados.</p>}</V3Section>
    <V3Section label="Cliente">{client ? <button type="button" className="v3-relation-row" onClick={() => onOpenClient(client.id)}><span><strong>Cliente vinculado</strong><small>{client.display_code ?? client.full_name}</small></span><span aria-hidden="true">→</span></button> : <p className="v3-section-copy">Sin cliente vinculado.</p>}</V3Section>
    <V3Section label="Datos"><dl className="v3-facts"><div><dt>Nombre</dt><dd>{lead.full_name}</dd></div><div><dt>Teléfono</dt><dd>{lead.phone}</dd></div><div><dt>Email</dt><dd>{lead.email ?? 'No disponible'}</dd></div><div><dt>Ciudad</dt><dd>{lead.city ?? 'No disponible'}</dd></div></dl></V3Section>
    <V3Section label="Historial"><p className="v3-section-copy">Estado actual: {getStatusLabel(lead.status)}. {draft ? `Borrador ${reviewed ? 'revisado' : 'pendiente'}.` : 'Sin borrador asociado.'}</p></V3Section>
    <V3SecondaryAction onClick={() => setIsMoreOpen(true)}>Más</V3SecondaryAction>
    {isMoreOpen ? <V3BottomSheet title="Más acciones del lead" onClose={() => setIsMoreOpen(false)}><div className="v3-bottom-sheet__content"><V3SecondaryAction onClick={() => { setIsMoreOpen(false); setIsEditOpen(true) }}>Editar lead</V3SecondaryAction><V3SecondaryAction onClick={() => { setIsMoreOpen(false); toggleArchive() }}>{lead.archived_at ? 'Restaurar lead' : 'Archivar lead'}</V3SecondaryAction>{draft ? <V3SecondaryAction onClick={() => void run(async () => { await regenerateLeadDraftMessages(draft) }, 'Borradores regenerados; requieren nueva revisión.')}>Regenerar borradores</V3SecondaryAction> : null}</div></V3BottomSheet> : null}
    {isEditOpen ? <V3BottomSheet title="Editar lead" onClose={() => setIsEditOpen(false)}><div className="v3-bottom-sheet__content"><label className="v3-field"><span>Nombre completo</span><V3Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="v3-field"><span>Teléfono</span><V3Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="v3-field"><span>Ciudad</span><V3Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label className="v3-field"><span>Estado</span><select className="v3-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="new">Nuevo</option><option value="contacted">Contactado</option><option value="quoted">Presupuestado</option><option value="won">Ganado</option><option value="lost">Perdido</option></select></label><V3Textarea aria-label="Notas" placeholder="Notas del lead" /><V3PrimaryAction onClick={saveEdit} disabled={isBusy}>Guardar cambios</V3PrimaryAction></div></V3BottomSheet> : null}
  </V3Page>
}
