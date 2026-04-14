import { useMemo, useState } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import type { LeadDraftRecord } from './types'

interface LeadDraftCardsProps {
  leadDraft: LeadDraftRecord | null
}

function getDraftPricing(leadDraft: LeadDraftRecord) {
  return leadDraft.pricing_breakdown ?? leadDraft.quote_draft_seed.pricingBreakdown ?? null
}

function getEmailSubject(leadDraft: LeadDraftRecord): string {
  const service = leadDraft.normalized_input.serviceNeedLabel ?? 'servicio de limpieza'
  const city = leadDraft.normalized_input.city ?? 'tu zona'
  return `CostaClean - presupuesto para ${service} en ${city}`
}

function getEmailBody(leadDraft: LeadDraftRecord): string {
  return leadDraft.ai_email_draft?.trim() || [
    `Hola ${leadDraft.suggested_full_name},`,
    '',
    'Hemos recibido tu solicitud de presupuesto y el equipo la revisará antes de responder.',
    '',
    'No enviado automáticamente.',
  ].join('\n')
}

function getWhatsAppMessage(leadDraft: LeadDraftRecord): string {
  return leadDraft.ai_whatsapp_draft?.trim() || getEmailBody(leadDraft)
}

function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.length === 9) return `34${digits}`
  return digits
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false
  await navigator.clipboard.writeText(text)
  return true
}

export function LeadDraftCards({ leadDraft }: LeadDraftCardsProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const pricing = leadDraft ? getDraftPricing(leadDraft) : null
  const emailSubject = useMemo(() => (leadDraft ? getEmailSubject(leadDraft) : ''), [leadDraft])
  const emailBody = useMemo(() => (leadDraft ? getEmailBody(leadDraft) : ''), [leadDraft])
  const whatsAppMessage = useMemo(() => (leadDraft ? getWhatsAppMessage(leadDraft) : ''), [leadDraft])

  if (!leadDraft) {
    return null
  }

  const input = leadDraft.normalized_input
  const quoteDraft = leadDraft.quote_draft_seed
  const whatsAppPhone = normalizeWhatsAppPhone(leadDraft.phone)
  const whatsAppHref = whatsAppPhone
    ? `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(whatsAppMessage)}`
    : null
  const mailtoHref = leadDraft.email
    ? `mailto:${leadDraft.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    : null

  function handleReviewQuote() {
    setActionError(null)
    setActionMessage('Borrador listo para revisión. La conversión a presupuesto CRM se habilitará en el flujo de aprobación.')
  }

  function handleSendEmail() {
    setActionError(null)
    if (!mailtoHref) {
      setActionMessage(null)
      setActionError('Este lead no tiene email registrado.')
      return
    }

    window.location.href = mailtoHref
    setActionMessage('Se abrió el borrador en el cliente de correo. Revisa antes de enviar.')
  }

  function handleOpenWhatsApp() {
    setActionError(null)
    if (!whatsAppHref) {
      setActionMessage(null)
      setActionError('Este lead no tiene un teléfono válido para WhatsApp.')
      return
    }

    window.open(whatsAppHref, '_blank', 'noopener,noreferrer')
    setActionMessage('Se abrió WhatsApp con el mensaje preparado. Revisa antes de enviar.')
  }

  async function handleCopyMessage() {
    setActionError(null)
    try {
      const didCopy = await copyToClipboard(whatsAppMessage)
      if (!didCopy) {
        setActionError('No se pudo acceder al portapapeles desde este navegador.')
        return
      }
      setActionMessage('Mensaje copiado al portapapeles.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo copiar el mensaje.')
    }
  }

  function handleRegenerateDraft() {
    setActionError(null)
    setActionMessage('Regeneración pendiente: el hook de IA está preparado, pero no se ejecuta automáticamente desde esta pantalla.')
  }

  return (
    <div className="cc-intake-draft-stack">
      <section className="cc-intake-draft-card" aria-label="Borrador de presupuesto">
        <div className="cc-intake-draft-card__header">
          <div>
            <p>Borrador de presupuesto</p>
            <h4>{quoteDraft.serviceSummary}</h4>
          </div>
          <span className="lead-badge">{quoteDraft.status}</span>
        </div>

        <div className="cc-intake-draft-grid">
          <div><span>Servicio</span><strong>{input.serviceNeedLabel ?? 'Sin dato'}</strong></div>
          <div><span>Propiedad</span><strong>{input.propertyType ?? 'Sin dato'}</strong></div>
          <div><span>Metros</span><strong>{input.sqmBand ?? 'Sin dato'}</strong></div>
          <div><span>Habitaciones</span><strong>{input.rooms ?? 'Sin dato'}</strong></div>
          <div><span>Baños</span><strong>{input.bathrooms ?? 'Sin dato'}</strong></div>
          <div><span>Fecha</span><strong>{formatDateEs(input.requestedServiceDate)}</strong></div>
          <div><span>Horario</span><strong>{input.preferredTimeSlot ?? 'Flexible'}</strong></div>
          <div><span>Total sin IVA</span><strong>{pricing ? formatCurrency(pricing.subtotal) : 'Pendiente'}</strong></div>
        </div>

        <div className="cc-intake-draft-actions">
          <button type="button" className="secondary-button" onClick={handleReviewQuote}>
            Review quote
          </button>
          <button type="button" className="secondary-button" onClick={handleRegenerateDraft}>
            Regenerate draft
          </button>
        </div>
      </section>

      <section className="cc-intake-draft-card" aria-label="Borradores de comunicación">
        <div className="cc-intake-draft-card__header">
          <div>
            <p>Comunicación</p>
            <h4>Borradores para revisión</h4>
          </div>
          <span className="lead-badge">No enviado</span>
        </div>

        <div className="cc-intake-message-preview">
          <div>
            <span>Asunto email</span>
            <strong>{emailSubject}</strong>
          </div>
          <div>
            <span>Cuerpo email</span>
            <p>{emailBody}</p>
          </div>
          <div>
            <span>WhatsApp</span>
            <p>{whatsAppMessage}</p>
          </div>
        </div>

        <div className="cc-intake-draft-actions">
          <button type="button" className="secondary-button" onClick={handleSendEmail}>
            Send email
          </button>
          <button type="button" className="secondary-button" onClick={handleOpenWhatsApp}>
            Open WhatsApp
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleCopyMessage()}>
            Copy message
          </button>
        </div>
      </section>

      {actionMessage ? (
        <div className="cc-alert cc-alert--success">
          <strong>Acción preparada</strong>
          <p>{actionMessage}</p>
        </div>
      ) : null}

      {actionError ? (
        <div className="cc-alert cc-alert--error">
          <strong>No se pudo completar la acción</strong>
          <p>{actionError}</p>
        </div>
      ) : null}
    </div>
  )
}
