import { PublicQuoteRequestForm } from '../features/publicIntake/PublicQuoteRequestForm'
import '../features/publicIntake/public-intake.css'

export function PublicQuoteRequestPage() {
  return (
    <main className="cc-public-intake-page">
      <section className="cc-public-intake-hero" aria-labelledby="public-quote-title">
        <div className="cc-public-intake-hero__topbar">
          <div className="cc-public-intake-hero__brand">
            <img
              src="/branding/Costa_Clean-LOGO-HORIZONTAL.png"
              alt="CostaClean"
              className="cc-public-intake-hero__logo"
            />
          </div>

          <span className="cc-public-intake-hero__pill">Presupuesto revisado</span>
        </div>

        <div className="cc-public-intake-hero__copy">
          <p className="cc-public-intake-eyebrow">Presupuesto de limpieza</p>
          <h1 id="public-quote-title">Cuéntanos qué necesitas.</h1>
          <p>
            Te prepararemos una propuesta clara para tu vivienda, oficina o alojamiento.
            No enviaremos nada automático.
          </p>
        </div>
      </section>

      <PublicQuoteRequestForm />
    </main>
  )
}
