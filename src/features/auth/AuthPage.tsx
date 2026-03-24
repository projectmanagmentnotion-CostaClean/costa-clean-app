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
      <section className="auth-card">
        <div className="auth-header">
          <p className="auth-kicker">CostaClean CRM</p>
          <h1>Acceso seguro</h1>
          <p>Inicia sesión para acceder al CRM y operar con datos protegidos.</p>
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
