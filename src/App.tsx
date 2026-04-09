import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { AppShell } from './app/AppShell'
import { AuthPage } from './features/auth/AuthPage'
import { getSupabaseClient } from './lib/supabase'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let bootTimer: number | null = null
    let authCleanup: (() => void) | undefined

    async function bootstrapAuth() {
      try {
        setBootError(null)
        const { client, error } = getSupabaseClient()

        if (error || !client) {
          if (isMounted) {
            setBootError(error ?? 'No se pudo crear el cliente de Supabase.')
            setIsBooting(false)
          }
          return
        }

        const {
          data: { session: currentSession },
          error: sessionError,
        } = await client.auth.getSession()

        if (sessionError) {
          if (isMounted) {
            setBootError(sessionError.message)
            setIsBooting(false)
          }
          return
        }

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (isMounted) {
            setSession(nextSession)
          }
        })

        authCleanup = () => {
          subscription.unsubscribe()
        }

        if (isMounted) {
          setSession(currentSession)
          bootTimer = window.setTimeout(() => {
            if (isMounted) {
              setIsBooting(false)
            }
          }, 560)
        }
      } catch (err) {
        if (isMounted) {
          setBootError(err instanceof Error ? err.message : 'Error desconocido iniciando la app.')
          setIsBooting(false)
        }
      }
    }

    void bootstrapAuth()

    return () => {
      isMounted = false
      if (bootTimer !== null) {
        window.clearTimeout(bootTimer)
      }
      if (authCleanup) {
        authCleanup()
      }
    }
  }, [])

  if (isBooting) {
    return (
      <main className="cc-boot-screen" aria-label="Iniciando CostaClean CRM">
        <div className="cc-boot-screen__wave" aria-hidden="true" />
        <div className="cc-boot-screen__glow cc-boot-screen__glow--one" />
        <div className="cc-boot-screen__glow cc-boot-screen__glow--two" />

        <section className="cc-boot-card">
          <div className="cc-boot-card__brand" aria-hidden="true">
            <img
              src="/branding/Costa_Clean-LOGO-HORIZONTAL.png"
              alt=""
              className="cc-boot-card__logo"
            />
          </div>

          <div className="cc-boot-card__copy">
            <p className="cc-boot-card__kicker">CostaClean CRM</p>
            <h1>Preparando tu centro de control</h1>
            <p>
              Cargando sesión, entorno seguro y experiencia operativa.
            </p>
          </div>

          <div className="cc-boot-card__loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    )
  }

  if (bootError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-header">
            <p className="auth-kicker">CostaClean CRM</p>
            <h1>Error de arranque</h1>
            <p>{bootError}</p>
          </div>
        </section>
      </main>
    )
  }

  if (!session) {
    return <AuthPage onSignedIn={() => undefined} />
  }

  return (
    <div className="cc-app-shell-enter">
      <AppShell />
    </div>
  )
}

export default App

