import type { ReactNode } from 'react'
import type { PortalFoundationData } from './PortalShell'
import type { PortalPage } from './portalNavigation'

interface PortalPagesProps {
  page: PortalPage | null
  data: PortalFoundationData
  getHref: (page: PortalPage) => string
}

export function PortalPages({ page, data, getHref }: PortalPagesProps) {
  if (!page) {
    return (
      <PortalPageFrame eyebrow="Área protegida" title="Página no disponible">
        <section className="portal-empty-state">
          <p>No podemos confirmar si este recurso existe.</p>
          <a className="portal-button portal-button--primary" href={getHref('home')}>
            Volver al inicio
          </a>
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'home') {
    return (
      <PortalPageFrame
        eyebrow="Resumen"
        title={`Hola, ${data.account.accountLabel}`}
        description="Un vistazo claro al siguiente paso, sin exponer información interna del CRM."
      >
        <section className="portal-decision-block">
          <div>
            <span className="portal-decision-block__label">Próximo servicio</span>
            <h2>{data.dashboard.nextServiceLabel}</h2>
            <p>Datos sintéticos exclusivos de la vista previa local.</p>
          </div>
          <a className="portal-button portal-button--primary" href={getHref('services')}>
            Revisar servicios
          </a>
        </section>

        <div className="portal-summary-grid" aria-label="Resumen de la cuenta">
          <PortalSummaryLink
            label="Propiedades"
            value={String(data.properties.length)}
            hint="Espacios visibles"
            href={getHref('properties')}
          />
          <PortalSummaryLink
            label="Solicitudes"
            value={String(data.dashboard.openRequestCount)}
            hint="Pendiente de revisión"
            href={getHref('requests')}
          />
          <PortalSummaryLink
            label="Documentos"
            value={String(data.dashboard.availableDocumentCount)}
            hint="Vista base, sin descarga"
            href={getHref('invoices')}
          />
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'profile') {
    return (
      <PortalPageFrame
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Contexto mínimo de la cuenta. Los cambios revisables se incorporarán en CP-3B.2."
      >
        <section className="portal-detail-list" aria-label="Datos de la cuenta">
          <PortalDetailRow label="Cliente" value={data.account.clientDisplayName} />
          <PortalDetailRow label="Cuenta" value={data.account.accountLabel} />
          <PortalDetailRow
            label="Rol"
            value={data.account.role === 'client_admin' ? 'Administrador del cliente' : 'Miembro del cliente'}
          />
          <PortalDetailRow label="Origen" value="Vista previa sintética CP-3A" />
        </section>
      </PortalPageFrame>
    )
  }

  if (page === 'properties') {
    return (
      <PortalPageFrame
        eyebrow="Espacios"
        title="Propiedades"
        description="Listado compacto y aislado. No existe acceso directo a la tabla canónica de propiedades."
      >
        <div className="portal-record-list">
          {data.properties.map((property) => (
            <article key={property.id} className="portal-record">
              <div>
                <h2>{property.displayName}</h2>
                <p>{property.addressLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{property.statusLabel}</span>
            </article>
          ))}
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'services') {
    return (
      <PortalPageFrame
        eyebrow="Actividad"
        title="Servicios"
        description="La vista base diferencia agenda y estado sin prometer cambios, fechas o guardados."
      >
        <div className="portal-record-list">
          {data.services.map((service) => (
            <article key={service.id} className="portal-record">
              <div>
                <h2>{service.serviceLabel}</h2>
                <p>{service.propertyLabel} · {service.scheduleLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{service.statusLabel}</span>
            </article>
          ))}
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'requests') {
    return (
      <PortalPageFrame
        eyebrow="Seguimiento"
        title="Solicitudes"
        description="Solo lectura en CP-3A. El workflow real e idempotente se implementará en CP-3B.3."
      >
        <div className="portal-record-list">
          {data.requests.map((request) => (
            <article key={request.id} className="portal-record">
              <div>
                <h2>{request.requestLabel}</h2>
                <p>{request.submittedLabel}</p>
              </div>
              <span className="portal-status portal-status--warning">{request.statusLabel}</span>
            </article>
          ))}
        </div>
      </PortalPageFrame>
    )
  }

  if (page === 'invoices') {
    return (
      <PortalPageFrame
        eyebrow="Documentos"
        title="Facturas"
        description="Estados de demostración sin validez fiscal, importes reales, descarga ni modificación financiera."
      >
        <div className="portal-record-list">
          {data.invoices.map((invoice) => (
            <article key={invoice.id} className="portal-record">
              <div>
                <h2>{invoice.referenceLabel}</h2>
                <p>{invoice.issuedLabel}</p>
              </div>
              <span className="portal-status portal-status--info">{invoice.paymentStatusLabel}</span>
            </article>
          ))}
        </div>
        <p className="portal-inline-note">
          La descarga privada con URL firmada de 60 segundos pertenece a CP-3B.4.
        </p>
      </PortalPageFrame>
    )
  }

  return (
    <PortalPageFrame
      eyebrow="Protección"
      title="Seguridad de la cuenta"
      description="Arquitectura preparada para sesiones, recuperación y MFA sin activarlos antes de CP-3B.1."
    >
      <section className="portal-security-list" aria-label="Controles de seguridad preparados">
        <PortalSecurityRow
          title="Separación CRM / portal"
          description="El portal usa un bootstrap y una navegación independientes."
          status="Activo en CP-3A"
        />
        <PortalSecurityRow
          title="Membresía explícita"
          description="El email nunca selecciona ni crea un cliente."
          status="Frontera definida"
        />
        <PortalSecurityRow
          title="MFA"
          description="La interfaz está preparada; la política y el flujo pertenecen a una fase posterior."
          status="No habilitado"
        />
      </section>
    </PortalPageFrame>
  )
}

interface PortalPageFrameProps {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}

function PortalPageFrame({ eyebrow, title, description, children }: PortalPageFrameProps) {
  return (
    <div className="portal-page" data-portal-page={title}>
      <header className="portal-page__header">
        <p className="portal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </div>
  )
}

interface PortalSummaryLinkProps {
  label: string
  value: string
  hint: string
  href: string
}

function PortalSummaryLink({ label, value, hint, href }: PortalSummaryLinkProps) {
  return (
    <a className="portal-summary-link" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </a>
  )
}

function PortalDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PortalSecurityRow({
  title,
  description,
  status,
}: {
  title: string
  description: string
  status: string
}) {
  return (
    <article className="portal-security-row">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="portal-status portal-status--info">{status}</span>
    </article>
  )
}
