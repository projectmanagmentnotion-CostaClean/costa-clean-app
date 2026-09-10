import { useState, type FormEvent, type ReactNode } from 'react'
import type { PortalMembershipRole } from './contracts'

interface PortalAccountExperienceProps {
  role: PortalMembershipRole
  pathname: string
  accountLabel: string
  onSignOut: () => void
  getHref: (page: 'home' | 'account' | 'help') => string
}

export function PortalAccountExperience({ role, pathname, accountLabel, onSignOut, getHref }: PortalAccountExperienceProps) {
  const route = pathname.replace('/portal/', '').replace(/\/$/u, '')
  if (route === 'members' || route.startsWith('members/')) return <MembersSurface role={role} pathname={pathname} getHref={getHref} />
  if (route === 'security/password') return <PasswordSurface />
  if (route === 'security/google') return <GoogleSurface />
  if (route === 'security') return <SecuritySurface getHref={getHref} />
  if (route === 'legal/privacy') return <LegalSurface title="Política de privacidad" description="Texto informativo pendiente de revisión legal profesional. La información de privacidad es independiente del consentimiento comercial." />
  if (route === 'legal/document') return <LegalSurface title="Condiciones del servicio" description="Documento contractual pendiente de validación legal profesional. El contenido mostrado en QA no constituye una publicación definitiva." />
  if (route === 'preferences/marketing') return <MarketingSurface />
  if (route === 'errors/session-expired') return <SafeErrorSurface title="Sesión caducada" description="Por seguridad, vuelve a iniciar sesión para continuar." />
  if (route === 'errors/network') return <SafeErrorSurface title="Problema de conexión" description="No pudimos sincronizar tu información. Comprueba la red e inténtalo de nuevo." />
  if (route === 'errors/forbidden') return <SafeErrorSurface title="Sección restringida" description="Tu rol actual no permite acceder a esta sección." />
  if (route === 'errors/generic') return <SafeErrorSurface title="No pudimos cargar la información" description="Se ha producido una incidencia inesperada. Inténtalo de nuevo más tarde." />
  if (route === 'errors/validation') return <SafeErrorSurface title="Revisa los campos" description="Hay información pendiente de corregir. El formulario señalará el campo concreto sin exponer detalles técnicos." />
  if (route === 'states/loading') return <PortalAccountFrame eyebrow="Cuenta" title="Procesando solicitud" description="Estamos preparando una respuesta segura. No cierres esta pantalla." />

  return (
    <PortalAccountFrame eyebrow="Cuenta" title="Centro de cuenta" description="Accesos de perfil, seguridad y ayuda en un solo sitio.">
      <div className="portal-account-grid">
        <AccountLink label="Perfil" value={accountLabel} href="/portal/profile" />
        <AccountLink label="Seguridad" value="Sesión protegida" href="/portal/security" />
        <AccountLink label="Equipo y accesos" value={role === 'client_admin' ? 'Gestionar miembros' : 'Ver miembros'} href="/portal/members" />
        <AccountLink label="Comunicaciones" value="Preferencias opcionales" href="/portal/preferences/marketing" />
      </div>
      <div className="portal-detail-list portal-detail-list--compact">
        <div className="portal-detail-row"><span>Cuenta</span><strong>{accountLabel}</strong></div>
        <div className="portal-detail-row"><span>Rol</span><strong>{role === 'client_admin' ? 'Administrador' : 'Miembro'}</strong></div>
      </div>
      <button type="button" className="portal-text-button" onClick={onSignOut}>Cerrar sesión</button>
    </PortalAccountFrame>
  )
}

function MembersSurface({ role, pathname, getHref }: Pick<PortalAccountExperienceProps, 'role' | 'pathname' | 'getHref'>) {
  if (pathname.endsWith('/invite')) return <InviteSurface />
  if (pathname.endsWith('/revoke')) return <RevokeSurface />
  return (
    <PortalAccountFrame eyebrow="Equipo y accesos" title="Miembros del equipo" description={role === 'client_admin' ? 'Invita y revisa los accesos autorizados a esta cuenta.' : 'Consulta los accesos de esta cuenta sin funciones de administración.'}>
      {role === 'client_admin' ? <>
        <section className="portal-empty-state"><span className="portal-status portal-status--info">Administrador</span><h2>Sin colaboradores adicionales</h2><p>Los miembros se mostrarán aquí cuando exista una lectura autorizada de la cuenta.</p><a className="portal-button portal-button--primary" href="/portal/members/invite">Invitar miembro</a></section>
        <p className="portal-account-note">La invitación requiere el canal seguro de cuenta. No se crea ninguna membresía desde esta pantalla.</p>
      </> : <section className="portal-empty-state"><span className="portal-status portal-status--info">Miembro</span><h2>Visualización de equipo</h2><p>No tienes controles para invitar, revocar o cambiar roles.</p><a className="portal-text-button" href={getHref('account')}>Volver a Cuenta</a></section>}
    </PortalAccountFrame>
  )
}

function InviteSurface() {
  const [submitted, setSubmitted] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSubmitted(true) }
  if (submitted) return <ActionUnavailable title="Invitación preparada" description="La invitación no se ha enviado: el canal seguro de entrega todavía no está configurado en este entorno." />
  return <PortalAccountFrame eyebrow="Equipo y accesos" title="Invitar miembro" description="Elige un correo y un rol compatible con la cuenta."><form className="portal-form" onSubmit={submit}><label className="portal-field"><span>Correo electrónico</span><input name="email" type="email" autoComplete="email" required /></label><label className="portal-field"><span>Rol de acceso</span><select name="role" defaultValue="client_member"><option value="client_member">Miembro</option><option value="client_admin">Administrador</option></select></label><p className="portal-account-note">La persona deberá aceptar una invitación segura antes de tener acceso. No se muestran tokens ni identificadores internos.</p><button className="portal-button portal-button--primary" type="submit">Enviar invitación</button></form></PortalAccountFrame>
}

function RevokeSurface() { return <ActionUnavailable title="Revocar acceso" description="La confirmación queda preparada para el contrato seguro de administración. Esta vista no elimina la identidad de acceso ni modifica datos del cliente." /> }

function SecuritySurface({ getHref }: Pick<PortalAccountExperienceProps, 'getHref'>) {
  return <PortalAccountFrame eyebrow="Protección" title="Seguridad y acceso" description="Revisa cómo se protege tu sesión y qué método de acceso tienes configurado."><div className="portal-account-grid"><AccountLink label="Contraseña" value="Gestionar acceso" href="/portal/security/password" /><AccountLink label="Cuenta de Google" value="Método de acceso" href="/portal/security/google" /></div><section className="portal-detail-list portal-detail-list--compact"><div className="portal-detail-row"><span>Sesión</span><strong>Protegida</strong></div><div className="portal-detail-row"><span>Tenancy</span><strong>Solo membresía explícita</strong></div></section><a className="portal-text-button" href={getHref('account')}>Volver a Cuenta</a></PortalAccountFrame>
}

function PasswordSurface() { return <ActionUnavailable title="Cambiar contraseña" description="El cambio se ejecutará mediante el proveedor de autenticación. La política efectiva la valida el servidor; no mostramos requisitos inventados." /> }
function GoogleSurface() { return <ActionUnavailable title="Cuenta de Google" description="Google autentica tu identidad, pero no concede por sí solo acceso a una cuenta de cliente. La vinculación se muestra únicamente cuando existe evidencia del proveedor." /> }
function LegalSurface({ title, description }: { title: string; description: string }) { return <PortalAccountFrame eyebrow="Legal" title={title} description={description}><section className="portal-legal-placeholder"><strong>PLACEHOLDER LEGAL — REVISIÓN PROFESIONAL PENDIENTE</strong><p>Consulta la versión aprobada antes de usar este contenido con clientes reales.</p></section><a className="portal-text-button" href="/portal/account">Volver a Cuenta</a></PortalAccountFrame> }
function MarketingSurface() { const [enabled, setEnabled] = useState(false); return <PortalAccountFrame eyebrow="Comunicaciones" title="Preferencias de comunicación" description="Los avisos necesarios para tus servicios permanecen activos. Las novedades comerciales son opcionales y están desactivadas inicialmente."><label className="portal-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>Novedades y protocolos de temporada</strong><small>{enabled ? 'Activado de forma opcional' : 'Desactivado'}</small></span></label><button type="button" className="portal-button portal-button--primary" disabled>Guardar preferencias</button><p className="portal-account-note">El contrato de actualización de preferencias todavía no está disponible en este cliente.</p></PortalAccountFrame> }
function SafeErrorSurface({ title, description }: { title: string; description: string }) { return <ActionUnavailable title={title} description={description} /> }
function ActionUnavailable({ title, description }: { title: string; description: string }) { return <PortalAccountFrame eyebrow="Área de clientes" title={title} description={description}><span className="portal-status portal-status--warning">No disponible en este entorno</span><a className="portal-text-button" href="/portal/account">Volver a Cuenta</a></PortalAccountFrame> }
function AccountLink({ label, value, href }: { label: string; value: string; href: string }) { return <a className="portal-summary-link" href={href}><span>{label}</span><strong>{value}</strong><small>Consultar</small></a> }
function PortalAccountFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) { return <section className="portal-page portal-account-page"><header className="portal-page__header"><p className="portal-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>{children}</section> }
