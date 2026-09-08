import type { ReactNode } from 'react'
import { buildMailtoUrl, buildTelUrl, buildWhatsAppUrl } from './contactActions'

interface V3ContactActionsProps {
  phone?: string | null
  email?: string | null
  clientName?: string
  compact?: boolean
}

function ContactLink({ href, label, children, external = false }: { href: string; label: string; children: ReactNode; external?: boolean }) {
  return <a className="v3-contact-action" href={href} aria-label={label} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={(event) => event.stopPropagation()}>{children}</a>
}

export function V3ContactActions({ phone, email, clientName = 'cliente', compact = false }: V3ContactActionsProps) {
  const whatsapp = buildWhatsAppUrl(phone, { text: `Hola ${clientName}, te escribimos de Costa Clean.` })
  const tel = buildTelUrl(phone)
  const mailto = buildMailtoUrl(email, { subject: `Costa Clean · ${clientName}` })
  if (!whatsapp && !tel && !mailto) return null

  return <div className={`v3-contact-actions${compact ? ' v3-contact-actions--compact' : ''}`} aria-label="Acciones de contacto">
    {whatsapp ? <ContactLink href={whatsapp} label={`Abrir WhatsApp de ${clientName}`} external>WhatsApp</ContactLink> : null}
    {tel ? <ContactLink href={tel} label={`Llamar a ${clientName}`}>Llamar</ContactLink> : null}
    {mailto ? <ContactLink href={mailto} label={`Enviar email a ${clientName}`}>Email</ContactLink> : null}
  </div>
}
