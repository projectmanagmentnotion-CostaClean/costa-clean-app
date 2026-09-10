import { useState, type FormEvent } from 'react'
import { PortalBrand } from './PortalBrand'

const steps = ['Tipo de cuenta', 'Identidad', 'Facturación', 'Privacidad', 'Revisión'] as const

export function PortalOnboardingFlow({ onSignOut }: { onSignOut: () => void }) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<'individual' | 'business'>('individual')
  const [marketing, setMarketing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) setStep((current) => current + 1)
    else setSubmitted(true)
  }

  return (
    <main className="portal-onboarding">
      <section className="portal-onboarding__panel" aria-labelledby="portal-onboarding-title">
        <PortalBrand />
        <div className="portal-onboarding__progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>
          <span>Paso {step + 1} de {steps.length}</span><strong>{steps[step]}</strong>
        </div>
        {submitted ? <>
          <p className="portal-eyebrow">Solicitud preparada</p>
          <h1 id="portal-onboarding-title">Tu solicitud está lista para revisión</h1>
          <p>El envío final requiere el canal seguro de cuenta. No se ha creado ninguna cuenta de cliente ni se ha concedido acceso.</p>
          <span className="portal-status portal-status--warning">Envío pendiente de contrato seguro</span>
        </> : <form className="portal-form" onSubmit={next}>
          <p className="portal-eyebrow">Alta de cliente</p>
          <h1 id="portal-onboarding-title">Configura tu acceso</h1>
          {step === 0 ? <fieldset className="portal-onboarding__choice"><legend>¿Cómo deseas registrarte?</legend><label><input type="radio" name="customer-type" checked={type === 'individual'} onChange={() => setType('individual')} /> Particular</label><label><input type="radio" name="customer-type" checked={type === 'business'} onChange={() => setType('business')} /> Empresa o autónomo</label></fieldset> : null}
          {step === 1 ? <><label className="portal-field"><span>Nombre {type === 'business' ? 'de contacto' : ''}</span><input autoComplete="given-name" required /></label><label className="portal-field"><span>Apellidos o razón social</span><input autoComplete="family-name" required /></label><label className="portal-field"><span>Teléfono de contacto</span><input type="tel" autoComplete="tel" required /></label></> : null}
          {step === 2 ? <><label className="portal-field"><span>Dirección fiscal</span><input autoComplete="street-address" required /></label><label className="portal-field"><span>Código postal</span><input inputMode="numeric" autoComplete="postal-code" required /></label><label className="portal-field"><span>Ciudad</span><input autoComplete="address-level2" required /></label><label className="portal-field"><span>Provincia o región</span><input autoComplete="address-level1" required /></label></> : null}
          {step === 3 ? <><label className="portal-toggle"><input type="checkbox" required /><span><strong>Acepto la información de privacidad</strong><small>Necesario para gestionar la solicitud. Consulta la política antes de continuar.</small></span></label><label className="portal-toggle"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><span><strong>Recibir novedades de Costa Clean</strong><small>{marketing ? 'Consentimiento opcional activado' : 'Desactivado por defecto'}</small></span></label><p className="portal-account-note">La comunicación comercial es opcional, separada y revocable; no condiciona el alta.</p></> : null}
          {step === 4 ? <section className="portal-onboarding__review"><p><strong>Modalidad</strong><br />{type === 'individual' ? 'Particular' : 'Empresa o autónomo'}</p><p><strong>Privacidad</strong><br />Aceptación obligatoria pendiente de envío</p><p><strong>Comunicaciones</strong><br />{marketing ? 'Opcionales activadas' : 'Desactivadas'}</p></section> : null}
          <button className="portal-button portal-button--primary portal-button--full" type="submit">{step === steps.length - 1 ? 'Enviar solicitud' : 'Continuar'}</button>
        </form>}
        <button className="portal-text-button" type="button" onClick={onSignOut}>Cerrar sesión</button>
      </section>
    </main>
  )
}
