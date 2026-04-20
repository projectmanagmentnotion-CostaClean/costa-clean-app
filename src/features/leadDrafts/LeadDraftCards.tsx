import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FeedbackDialog, type FeedbackDialogTone } from '../../components/FeedbackDialog'
import { calculatePricing } from '../../config/leadQuoteMessagingEngineAccess'
import type { ClientListItem } from '../clients/types'
import type { LeadListItem } from '../leads/types'
import {
  convertReviewedLeadDraftToQuote,
  createOrLinkClientFromReviewedLeadDraft,
  markLeadDraftReviewed,
} from './leadDraftConversion'
import { regenerateLeadDraftMessages, type LeadMessageDraftResponse } from './leadDraftMessagingApi'
import type { LeadDraftRecord } from './types'

interface LeadDraftCardsProps {
  lead: LeadListItem
  leadDraft: LeadDraftRecord | null
  clients: ClientListItem[]
  onWorkflowUpdated: () => Promise<void>
}

type ActionStatusTone = 'loading' | 'success' | 'error' | 'review'
type ConfirmedAction = 'review' | 'client' | 'quote' | 'regenerate'

interface ActionStatus {
  tone: ActionStatusTone
  title: string
  message: string
}

function getDraftPricing(leadDraft: LeadDraftRecord) {
  return leadDraft.pricing_breakdown ?? leadDraft.quote_draft_seed.pricingBreakdown ?? calculatePricing(leadDraft.normalized_input)
}

function getEmailSubject(leadDraft: LeadDraftRecord): string {
  const metadataSubject = leadDraft.ai_generation_metadata?.email_subject
  if (typeof metadataSubject === 'string' && metadataSubject.trim()) {
    return metadataSubject.trim()
  }

  const service = leadDraft.normalized_input.serviceNeedLabel ?? 'servicio de limpieza'
  const city = leadDraft.normalized_input.city ?? 'tu zona'
  return `Costa Clean BCN - presupuesto para ${service} en ${city}`
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

function getClientActionMessage(action: 'created' | 'linked_existing' | 'already_converted'): string {
  if (action === 'created') return 'Cliente creado, lead marcado como ganado y presupuestos del lead vinculados.'
  if (action === 'linked_existing') return 'Cliente existente vinculado, lead marcado como ganado y presupuestos del lead vinculados.'
  return 'El lead ya tenia cliente convertido y vinculado.'
}

function getFeedbackTone(tone: ActionStatusTone): FeedbackDialogTone {
  if (tone === 'review') return 'warning'
  return tone
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false
  await navigator.clipboard.writeText(text)
  return true
}

export function LeadDraftCards({
  lead,
  leadDraft,
  clients,
  onWorkflowUpdated,
}: LeadDraftCardsProps) {
  const [draftOverride, setDraftOverride] = useState<LeadDraftRecord | null>(null)
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null)
  const [isActionRunning, setIsActionRunning] = useState(false)
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction | null>(null)

  useEffect(() => {
    setDraftOverride(null)
    setActionStatus(null)
  }, [leadDraft?.id])

  const activeDraft = draftOverride ?? leadDraft
  const pricing = activeDraft ? getDraftPricing(activeDraft) : null
  const emailSubject = useMemo(() => (activeDraft ? getEmailSubject(activeDraft) : ''), [activeDraft])
  const emailBody = useMemo(() => (activeDraft ? getEmailBody(activeDraft) : ''), [activeDraft])
  const whatsAppMessage = useMemo(() => (activeDraft ? getWhatsAppMessage(activeDraft) : ''), [activeDraft])

  if (!activeDraft) {
    return null
  }

  const currentDraft = activeDraft
  const input = currentDraft.normalized_input
  const quoteDraft = currentDraft.quote_draft_seed
  const whatsAppPhone = normalizeWhatsAppPhone(currentDraft.phone)
  const whatsAppHref = whatsAppPhone
    ? `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(whatsAppMessage)}`
    : null
  const mailtoHref = currentDraft.email
    ? `mailto:${currentDraft.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
    : null
  const isReviewed = currentDraft.ai_draft_status === 'reviewed'
  const generationSource = currentDraft.ai_generation_metadata?.source ?? currentDraft.ai_generation_metadata?.provider ?? 'placeholder'
  const canConvertDraft = (
    (
      currentDraft.status === 'ready_for_review' ||
      currentDraft.status === 'matched_existing_lead' ||
      currentDraft.status === 'converted'
    ) &&
    isReviewed
  )

  function setLoadingStatus(message: string) {
    setActionStatus({
      tone: 'loading',
      title: 'Procesando acción',
      message,
    })
  }

  const confirmationContent: Record<ConfirmedAction, {
    title: string
    confirmLabel: string
    description: string
  }> = {
    review: {
      title: 'Registrar revision manual',
      confirmLabel: 'Registrar revision',
      description: 'Confirma que ya revisaste alcance, precio, condiciones obligatorias y borradores. Despues se desbloquean cliente, presupuesto y comunicaciones manuales.',
    },
    client: {
      title: 'Crear o vincular cliente',
      confirmLabel: 'Crear/vincular',
      description: 'Se ejecutara la conversion transaccional del lead a cliente y se vincularan sus presupuestos. Usalo solo si el lead debe dejar de ser oportunidad activa.',
    },
    quote: {
      title: 'Crear presupuesto CRM',
      confirmLabel: 'Crear presupuesto',
      description: 'Se recalculara el presupuesto con el motor Costa Clean BCN. Si ya existe un borrador del lead, se actualizara con las nuevas lineas, totales y notas.',
    },
    regenerate: {
      title: 'Regenerar borradores IA',
      confirmLabel: 'Regenerar',
      description: 'Se crearan nuevos borradores de email y WhatsApp desde el pricing actual. La revision manual volvera a quedar pendiente antes de abrir, copiar o enviar.',
    },
  }

  function setSuccessStatus(title: string, message: string) {
    setActionStatus({ tone: 'success', title, message })
  }

  function setReviewStatus(message: string) {
    setActionStatus({
      tone: 'review',
      title: 'Pendiente de revisión manual',
      message,
    })
  }

  function setErrorStatus(error: unknown, fallback: string) {
    setActionStatus({
      tone: 'error',
      title: 'No se pudo completar la acción',
      message: error instanceof Error ? error.message : fallback,
    })
  }

  function applyRegeneratedDraft(result: LeadMessageDraftResponse) {
    setDraftOverride({
      ...currentDraft,
      quote_draft_seed: result.quote_draft_seed,
      pricing_breakdown: result.pricing_breakdown,
      ai_email_draft: result.email_body,
      ai_whatsapp_draft: result.whatsapp_message,
      ai_draft_status: 'drafted',
      ai_generation_metadata: {
        ...(currentDraft.ai_generation_metadata ?? {}),
        ...result.metadata,
        email_subject: result.email_subject,
        review_notes: result.review_notes,
        source: result.source,
      },
    })
  }

  async function handleReviewQuote() {
    setLoadingStatus('Guardando la revisión manual del presupuesto y los borradores.')
    setIsActionRunning(true)

    try {
      await markLeadDraftReviewed(currentDraft.id)
      setDraftOverride({
        ...currentDraft,
        ai_draft_status: 'reviewed',
      })
      await onWorkflowUpdated()
      setSuccessStatus(
        'Revisión registrada',
        'Ya puedes crear o vincular el cliente, crear el presupuesto CRM y abrir comunicaciones manuales.',
      )
    } catch (error) {
      setErrorStatus(error, 'No se pudo registrar la revisión manual.')
    } finally {
      setIsActionRunning(false)
    }
  }

  async function handleCreateOrLinkClient() {
    setLoadingStatus('Comprobando clientes existentes y vinculando este lead si corresponde.')
    setIsActionRunning(true)

    try {
      const result = await createOrLinkClientFromReviewedLeadDraft(lead, currentDraft, clients)
      await onWorkflowUpdated()
      setSuccessStatus('Cliente actualizado', getClientActionMessage(result.clientAction))
    } catch (error) {
      setErrorStatus(error, 'No se pudo crear o vincular el cliente.')
    } finally {
      setIsActionRunning(false)
    }
  }

  async function handleCreateQuote() {
    setLoadingStatus('Creando el presupuesto CRM en estado borrador desde el lead revisado.')
    setIsActionRunning(true)

    try {
      const result = await convertReviewedLeadDraftToQuote(lead, currentDraft, clients)
      await onWorkflowUpdated()
      setDraftOverride({
        ...currentDraft,
        status: 'converted',
      })
      setSuccessStatus(
        'Presupuesto CRM actualizado',
        `Presupuesto ${result.quoteId} guardado con los ultimos calculos del motor y vinculado al lead ${result.leadId}.`,
      )
    } catch (error) {
      setErrorStatus(error, 'No se pudo crear el presupuesto CRM.')
    } finally {
      setIsActionRunning(false)
    }
  }

  function handleSendEmail() {
    if (!isReviewed) {
      setReviewStatus('Revisa manualmente el presupuesto y los borradores de comunicación antes de abrir el email.')
      return
    }

    if (!mailtoHref) {
      setErrorStatus(null, 'Este lead no tiene email registrado.')
      return
    }

    window.location.href = mailtoHref
    setSuccessStatus('Borrador de email abierto', 'Revisa el contenido en tu cliente de correo antes de enviar.')
  }

  function handleOpenWhatsApp() {
    if (!isReviewed) {
      setReviewStatus('Revisa manualmente el presupuesto y los borradores de comunicación antes de abrir WhatsApp.')
      return
    }

    if (!whatsAppHref) {
      setErrorStatus(null, 'Este lead no tiene un teléfono válido para WhatsApp.')
      return
    }

    window.open(whatsAppHref, '_blank', 'noopener,noreferrer')
    setSuccessStatus('WhatsApp abierto', 'El mensaje quedó preparado. Revisa antes de enviar manualmente.')
  }

  async function handleCopyMessage() {
    if (!isReviewed) {
      setReviewStatus('Revisa manualmente el presupuesto y los borradores de comunicación antes de copiar el mensaje.')
      return
    }

    try {
      const didCopy = await copyToClipboard(whatsAppMessage)
      if (!didCopy) {
        setErrorStatus(null, 'No se pudo acceder al portapapeles desde este navegador.')
        return
      }
      setSuccessStatus('Mensaje copiado', 'El borrador quedó en el portapapeles. Revisa antes de enviarlo.')
    } catch (error) {
      setErrorStatus(error, 'No se pudo copiar el mensaje.')
    }
  }

  async function handleRegenerateDraft() {
    setLoadingStatus('Generando y guardando nuevos borradores de email y WhatsApp.')
    setIsActionRunning(true)

    try {
      const result = await regenerateLeadDraftMessages(currentDraft)
      applyRegeneratedDraft(result)
      await onWorkflowUpdated()
      setSuccessStatus(
        result.source === 'openai' ? 'Borradores IA actualizados' : 'Borradores fallback actualizados',
        result.source === 'openai'
          ? 'Borradores generados con OpenAI y guardados para revisión manual.'
          : 'OpenAI no estuvo disponible. Se guardaron borradores fallback del motor para revisión manual.',
      )
    } catch (error) {
      setErrorStatus(error, 'No se pudieron regenerar los borradores.')
    } finally {
      setIsActionRunning(false)
    }
  }

  function handleConfirmedAction() {
    const action = confirmedAction
    if (!action) return

    setConfirmedAction(null)
    if (action === 'review') void handleReviewQuote()
    if (action === 'client') void handleCreateOrLinkClient()
    if (action === 'quote') void handleCreateQuote()
    if (action === 'regenerate') void handleRegenerateDraft()
  }

  const activeConfirmation = confirmedAction ? confirmationContent[confirmedAction] : null

  return (
    <div className="cc-intake-draft-stack">
      <details className="cc-intake-draft-card cc-intake-draft-card--collapsible cc-collapsible-section" aria-label="Revisión manual" open>
        <summary className="cc-intake-draft-card__header cc-intake-draft-card__summary cc-collapsible-section__summary">
          <div>
            <p>Revisión obligatoria</p>
            <h4>{isReviewed ? 'Borrador revisado' : 'Pendiente de revisión manual'}</h4>
          </div>
          <span className="lead-badge">{isReviewed ? 'Revisado' : 'Bloqueado'}</span>
        </summary>

        <div className="cc-intake-draft-card__body">
          <p className="detail-helper">
            La conversión crea registros CRM, pero no envía email ni WhatsApp. Revisa alcance, precio, datos de contacto y comunicación antes de continuar.
          </p>

          <div className="cc-intake-draft-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmedAction('review')}
              disabled={isActionRunning || isReviewed}
            >
              {isReviewed ? 'Revisión registrada' : 'Marcar revisión manual'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmedAction('client')}
              disabled={isActionRunning || !canConvertDraft}
            >
              Crear/vincular cliente
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setConfirmedAction('quote')}
              disabled={isActionRunning || !canConvertDraft || !pricing}
            >
              {currentDraft.status === 'converted' ? 'Actualizar presupuesto CRM' : 'Crear presupuesto CRM'}
            </button>
          </div>
        </div>
      </details>

      <details className="cc-intake-draft-card cc-intake-draft-card--collapsible cc-collapsible-section" aria-label="Borrador de presupuesto" open>
        <summary className="cc-intake-draft-card__header cc-intake-draft-card__summary cc-collapsible-section__summary">
          <div>
            <p>Borrador de presupuesto</p>
            <h4>{quoteDraft.serviceSummary}</h4>
          </div>
          <span className="lead-badge">{quoteDraft.status}</span>
        </summary>

        <div className="cc-intake-draft-card__body">
          <div className="cc-intake-draft-grid">
            <div><span>Servicio</span><strong>{input.serviceNeedLabel ?? 'Sin dato'}</strong></div>
            <div><span>Propiedad</span><strong>{input.propertyType ?? 'Sin dato'}</strong></div>
            <div><span>Metros</span><strong>{input.sqmBand ?? 'Sin dato'}</strong></div>
            <div><span>Habitaciones</span><strong>{input.rooms ?? 'Sin dato'}</strong></div>
            <div><span>Baños</span><strong>{input.bathrooms ?? 'Sin dato'}</strong></div>
            <div><span>Fecha</span><strong>{formatDateEs(input.requestedServiceDate)}</strong></div>
            <div><span>Horario</span><strong>{input.preferredTimeSlot ?? 'Flexible'}</strong></div>
            <div><span>Motor</span><strong>{pricing?.engineVersion ? `${pricing.engineId ?? 'engine'} v${pricing.engineVersion}` : pricing?.version ?? 'Pendiente'}</strong></div>
            <div><span>Equipo</span><strong>{pricing?.totalHours ? `${pricing.operators ?? '-'} op. x ${pricing.hoursPerOperator ?? '-'}h · ${pricing.totalHours}h` : 'Pendiente'}</strong></div>
            <div><span>Modelo</span><strong>{pricing?.priceStructure === 'mixed' ? 'Mixto con IVA sobre parte facturada' : 'Estandar'}</strong></div>
            <div><span>Total sin IVA</span><strong>{pricing ? formatCurrency(pricing.subtotal) : 'Pendiente'}</strong></div>
            <div><span>IVA motor</span><strong>{pricing ? formatCurrency(pricing.taxAmount) : 'Pendiente'}</strong></div>
            <div><span>Total cliente</span><strong>{pricing ? formatCurrency(pricing.total) : 'Pendiente'}</strong></div>
          </div>

          {pricing?.limitations?.length ? (
            <div className="cc-intake-engine-note">
              <strong>Limites por datos no capturados</strong>
              <p>{pricing.limitations.join(' ')}</p>
            </div>
          ) : null}

          <div className="cc-intake-draft-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setConfirmedAction('regenerate')}
              disabled={isActionRunning}
            >
              {isActionRunning ? 'Regenerando...' : 'Regenerar borradores IA'}
            </button>
          </div>
        </div>
      </details>

      <details className="cc-intake-draft-card cc-intake-draft-card--collapsible cc-collapsible-section" aria-label="Borradores de comunicación" open>
        <summary className="cc-intake-draft-card__header cc-intake-draft-card__summary cc-collapsible-section__summary">
          <div>
            <p>Comunicación</p>
            <h4>Borradores para revisión</h4>
          </div>
          <span className="lead-badge">No enviado</span>
        </summary>

        <div className="cc-intake-draft-card__body">
          <div className="cc-intake-message-preview">
            <div>
              <span>Origen actual</span>
              <strong>{generationSource === 'openai' ? 'OpenAI' : generationSource === 'fallback' ? 'Fallback del motor' : 'Plantilla del motor'}</strong>
            </div>
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
            <button type="button" className="secondary-button" onClick={handleSendEmail} disabled={!isReviewed || isActionRunning}>
              Abrir borrador email
            </button>
            <button type="button" className="secondary-button" onClick={handleOpenWhatsApp} disabled={!isReviewed || isActionRunning}>
              Abrir WhatsApp
            </button>
            <button type="button" className="secondary-button" onClick={() => void handleCopyMessage()} disabled={!isReviewed || isActionRunning}>
              Copiar mensaje
            </button>
          </div>
        </div>
      </details>

      <ConfirmDialog
        isOpen={Boolean(activeConfirmation)}
        title={activeConfirmation?.title ?? ''}
        description={activeConfirmation?.description ?? ''}
        confirmLabel={activeConfirmation?.confirmLabel ?? 'Confirmar'}
        tone={confirmedAction === 'quote' || confirmedAction === 'regenerate' ? 'warning' : 'default'}
        isBusy={isActionRunning}
        onCancel={() => setConfirmedAction(null)}
        onConfirm={handleConfirmedAction}
      />

      <FeedbackDialog
        isOpen={Boolean(actionStatus)}
        tone={actionStatus ? getFeedbackTone(actionStatus.tone) : 'info'}
        title={actionStatus?.title ?? ''}
        message={actionStatus?.message ?? ''}
        onClose={actionStatus?.tone === 'loading' ? undefined : () => setActionStatus(null)}
      />
    </div>
  )
}
