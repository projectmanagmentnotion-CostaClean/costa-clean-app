import { useState, type FormEvent } from 'react'
import { PortalBrand } from './PortalBrand'
import { submitPortalApplication, type PortalOnboardingInput } from './adapters/portalAccountActions'

const steps = ['Tipo de cuenta', 'Identidad', 'Facturación', 'Privacidad', 'Revisión'] as const

const initialForm: PortalOnboardingInput = {
  customerType: 'individual',
  firstName: '',
  lastName: '',
  legalName: '',
  tradeName: '',
  taxId: '',
  contactPerson: '',
  contactPhone: '',
  billingAddress: '',
  postalCode: '',
  city: '',
  region: '',
  country: 'ES',
  marketingOptIn: false,
  locale: 'es-ES',
  legalAccepted: false,
  idempotencyKey: '',
}

export function PortalOnboardingFlow({ onSignOut }: { onSignOut: () => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PortalOnboardingInput>(() => ({ ...initialForm, idempotencyKey: createIdempotencyKey() }))
  const [status, setStatus] = useState<'editing' | 'submitting' | 'pending_review' | 'error'>('editing')

  function updateField<Key extends keyof PortalOnboardingInput>(key: Key, value: PortalOnboardingInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) setStep((current) => current + 1)
    else {
      setStatus('submitting')
      try {
        await submitPortalApplication({
          ...form,
          firstName: form.customerType === 'individual' ? form.firstName || null : null,
          lastName: form.customerType === 'individual' ? form.lastName || null : null,
          legalName: form.customerType === 'business' ? form.legalName || null : null,
          tradeName: form.customerType === 'business' ? form.tradeName || null : null,
          taxId: form.customerType === 'business' ? form.taxId || null : null,
          contactPerson: form.customerType === 'business' ? form.contactPerson || null : form.firstName || null,
          contactPhone: form.contactPhone || null,
          billingAddress: form.billingAddress || null,
          postalCode: form.postalCode || null,
          city: form.city || null,
          region: form.region || null,
        })
        setStatus('pending_review')
      } catch {
        setStatus('error')
      }
    }
  }

  return (
    <main className="portal-onboarding">
      <section className="portal-onboarding__panel" aria-labelledby="portal-onboarding-title">
        <PortalBrand />
        <div className="portal-onboarding__progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>
          <span>Paso {step + 1} de {steps.length}</span><strong>{steps[step]}</strong>
        </div>
        {status === 'pending_review' ? <>
          <p className="portal-eyebrow">Solicitud preparada</p>
          <h1 id="portal-onboarding-title">Tu solicitud está lista para revisión</h1>
          <p>Hemos recibido tu solicitud. Costa Clean la revisará antes de conceder acceso al portal.</p>
          <span className="portal-status portal-status--info">Pendiente de revisión</span>
        </> : <form className="portal-form" onSubmit={next}>
          <p className="portal-eyebrow">Alta de cliente</p>
          <h1 id="portal-onboarding-title">Configura tu acceso</h1>
          {step === 0 ? <fieldset className="portal-onboarding__choice"><legend>¿Cómo deseas registrarte?</legend><label><input type="radio" name="customer-type" checked={form.customerType === 'individual'} onChange={() => updateField('customerType', 'individual')} /> Particular</label><label><input type="radio" name="customer-type" checked={form.customerType === 'business'} onChange={() => updateField('customerType', 'business')} /> Empresa o autónomo</label></fieldset> : null}
          {step === 1 && form.customerType === 'individual' ? <><label className="portal-field"><span>Nombre</span><input value={form.firstName ?? ''} onChange={(event) => updateField('firstName', event.target.value)} autoComplete="given-name" required /></label><label className="portal-field"><span>Apellidos</span><input value={form.lastName ?? ''} onChange={(event) => updateField('lastName', event.target.value)} autoComplete="family-name" required /></label><label className="portal-field"><span>Teléfono de contacto</span><input value={form.contactPhone ?? ''} onChange={(event) => updateField('contactPhone', event.target.value)} type="tel" autoComplete="tel" required /></label></> : null}
          {step === 1 && form.customerType === 'business' ? <><label className="portal-field"><span>Razón social</span><input value={form.legalName ?? ''} onChange={(event) => updateField('legalName', event.target.value)} autoComplete="organization" required /></label><label className="portal-field"><span>Nombre comercial (opcional)</span><input value={form.tradeName ?? ''} onChange={(event) => updateField('tradeName', event.target.value)} autoComplete="organization" /></label><label className="portal-field"><span>NIF/VAT</span><input value={form.taxId ?? ''} onChange={(event) => updateField('taxId', event.target.value)} required /></label><label className="portal-field"><span>Persona de contacto</span><input value={form.contactPerson ?? ''} onChange={(event) => updateField('contactPerson', event.target.value)} autoComplete="name" required /></label><label className="portal-field"><span>Teléfono de contacto</span><input value={form.contactPhone ?? ''} onChange={(event) => updateField('contactPhone', event.target.value)} type="tel" autoComplete="tel" required /></label></> : null}
          {step === 2 ? <><label className="portal-field"><span>Dirección fiscal</span><input value={form.billingAddress ?? ''} onChange={(event) => updateField('billingAddress', event.target.value)} autoComplete="street-address" required /></label><label className="portal-field"><span>Código postal</span><input value={form.postalCode ?? ''} onChange={(event) => updateField('postalCode', event.target.value)} inputMode="numeric" autoComplete="postal-code" required /></label><label className="portal-field"><span>Ciudad</span><input value={form.city ?? ''} onChange={(event) => updateField('city', event.target.value)} autoComplete="address-level2" required /></label><label className="portal-field"><span>Provincia o región</span><input value={form.region ?? ''} onChange={(event) => updateField('region', event.target.value)} autoComplete="address-level1" required /></label><input type="hidden" name="country" value={form.country} /></> : null}
          {step === 3 ? <><label className="portal-toggle"><input type="checkbox" checked={form.legalAccepted} onChange={(event) => updateField('legalAccepted', event.target.checked)} required /><span><strong>Acepto la información de privacidad</strong><small>Necesario para gestionar la solicitud. Consulta la política antes de continuar.</small></span></label><label className="portal-toggle"><input type="checkbox" checked={form.marketingOptIn} onChange={(event) => updateField('marketingOptIn', event.target.checked)} /><span><strong>Recibir novedades de Costa Clean</strong><small>{form.marketingOptIn ? 'Consentimiento opcional activado' : 'Desactivado por defecto'}</small></span></label><p className="portal-account-note">La comunicación comercial es opcional, separada y revocable; no condiciona el alta.</p></> : null}
          {step === 4 ? <section className="portal-onboarding__review"><p><strong>Modalidad</strong><br />{form.customerType === 'individual' ? 'Particular' : 'Empresa o autónomo'}</p><p><strong>País</strong><br />España ({form.country})</p><p><strong>Privacidad</strong><br />{form.legalAccepted ? 'Aceptada' : 'Pendiente'}</p><p><strong>Comunicaciones</strong><br />{form.marketingOptIn ? 'Opcionales activadas' : 'Desactivadas'}</p></section> : null}
          {status === 'error' ? <p className="portal-status portal-status--danger" role="alert">No se pudo enviar la solicitud. Tus datos se mantienen para reintentar.</p> : null}
          <button className="portal-button portal-button--primary portal-button--full" type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Enviando…' : step === steps.length - 1 ? 'Enviar solicitud' : 'Continuar'}</button>
        </form>}
        <button className="portal-text-button" type="button" onClick={onSignOut}>Cerrar sesión</button>
      </section>
    </main>
  )
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
