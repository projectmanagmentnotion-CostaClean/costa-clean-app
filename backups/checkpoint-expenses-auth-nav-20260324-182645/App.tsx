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

        if (isMounted) {
          setSession(currentSession)
          setIsBooting(false)
        }

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession)
        })

        return () => {
          subscription.unsubscribe()
        }
      } catch (err) {
        if (isMounted) {
          setBootError(err instanceof Error ? err.message : 'Error desconocido iniciando la app.')
          setIsBooting(false)
        }
      }
    }

    const cleanupPromise = bootstrapAuth()

    return () => {
      isMounted = false
      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === 'function') cleanup()
      })
    }
  }, [])

  if (isBooting) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-header">
            <p className="auth-kicker">CostaClean CRM</p>
            <h1>Iniciando</h1>
            <p>Comprobando sesión y preparando el acceso seguro.</p>
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

  return <AppShell />
}

export default App
