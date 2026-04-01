import { useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import './auth.css'

interface AuthPageProps {
  onSignedIn: () => Promise<void> | void
}

export function AuthPage({ onSignedIn }: AuthPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const { client, error: clientError } = getSupabaseClient()

      if (clientError || !client) {
        setError(clientError ?? 'No se pudo crear el cliente de Supabase.')
        return
      }

      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      await onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido iniciando sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__ambient auth-page__ambient--one" aria-hidden="true" />
      <div className="auth-page__ambient auth-page__ambient--two" aria-hidden="true" />

      <section className="auth-card">
        <div className="auth-page__wave" aria-hidden="true" />
        <div className="auth-card__topbar">
          <div className="auth-brand">
            <div className="auth-brand__mark" aria-hidden="true">
              <img
                src="/branding/Costa_Clean-LOGO.png"
                alt=""
                className="auth-brand__mark-image"
              />
            </div>

            <div className="auth-brand__copy">
              <p className="auth-kicker">CostaClean CRM</p>
              <img
                src="/branding/Costa_Clean-LOGO-HORIZONTAL.png"
                alt="CostaClean"
                className="auth-brand__logo"
              />
              <span className="auth-brand__subtitle">Control operativo · limpieza premium</span>
            </div>
          </div>

          <span className="auth-status-pill">Acceso seguro</span>
        </div>

        <div className="auth-header">
          <h1>Entra a tu centro de control</h1>
          <p>
            Accede al entorno operativo de CostaClean con una experiencia rápida,
            clara y preparada para móvil.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tuemail@empresa.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Accediendo...' : 'Entrar al CRM'}
          </button>

          {error ? (
            <div className="auth-error">
              <strong>No se pudo iniciar sesión</strong>
              <p>{error}</p>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  )
}

