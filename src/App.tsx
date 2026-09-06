import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { AppShell } from './app/AppShell'
import { BuildInfoBadge } from './app/BuildInfoBadge'
import { shouldShowBuildInfo } from './app/buildInfo'
import { applyTheme, getInitialTheme, getThemeFeedback, setStoredTheme, type AppTheme } from './app/theme'
import { AuthPage } from './features/auth/AuthPage'
import { createLogoutFlow } from './features/auth/logoutFlow'
import { clearStoredSupabaseSession, getSupabaseClient } from './lib/supabase'
import { isPublicGymManualQuizPath, isPublicQuoteRequestPath } from './app/publicStandaloneRoutes'
import { PublicGymManualQuizPage } from './pages/PublicGymManualQuizPage'
import { PublicQuoteRequestPage } from './pages/PublicQuoteRequestPage'
import { DevStepFlowPreviewPage } from './pages/DevStepFlowPreviewPage'
import { ToastProvider } from './shared/toasts/ToastProvider'

function isRecoverableAuthBootstrapError(message: string) {
  const normalizedMessage = message.trim().toLowerCase()

  return normalizedMessage.includes('failed to fetch')
    || normalizedMessage.includes('networkerror')
    || normalizedMessage.includes('load failed')
    || normalizedMessage.includes('lock broken by another request')
}

function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isPublicQuoteRequestStandalone = isPublicQuoteRequestPath(pathname)
  const isPublicGymManualQuizStandalone = isPublicGymManualQuizPath(pathname)
  const isPublicStandalonePath = isPublicQuoteRequestStandalone || isPublicGymManualQuizStandalone
  const isDevStepFlowPreview = import.meta.env.DEV && pathname === '/dev/step-flow-preview'
  const showBuildInfo = shouldShowBuildInfo()
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme())
  const [themeFeedback, setThemeFeedback] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isBooting, setIsBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const runLogout = useMemo(() => createLogoutFlow({
    signOut: async () => {
      const { client } = getSupabaseClient()

      if (!client) {
        return { error: true }
      }

      return client.auth.signOut()
    },
    onPendingChange: setIsSigningOut,
    onSignedOut: () => {
      clearStoredSupabaseSession()
      setSession(null)
    },
  }), [])
  const bootLogoSrc = theme === 'light'
    ? '/branding/Costa_Clean-LOGO-AZUL.png'
    : '/branding/Costa_Clean-LOGO-HORIZONTAL.png'

  useEffect(() => {
    applyTheme(theme)
    setStoredTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!themeFeedback) return undefined

    const feedbackTimer = window.setTimeout(() => {
      setThemeFeedback(null)
    }, 1800)

    return () => {
      window.clearTimeout(feedbackTimer)
    }
  }, [themeFeedback])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
      setThemeFeedback(getThemeFeedback(nextTheme))
      return nextTheme
    })
  }, [])

  useEffect(() => {
    let isMounted = true
    let bootTimer: number | null = null
    let authCleanup: (() => void) | undefined

    async function bootstrapAuth() {
      if (isPublicStandalonePath || isDevStepFlowPreview) {
        if (isMounted) {
          setIsBooting(false)
        }
        return
      }

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
          if (isRecoverableAuthBootstrapError(sessionError.message)) {
            clearStoredSupabaseSession()

            if (isMounted) {
              setSession(null)
              setIsBooting(false)
            }
            return
          }

          if (isMounted) {
            setBootError(sessionError.message)
            setIsBooting(false)
          }
          return
        }

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((event, nextSession) => {
          if (event === 'SIGNED_OUT') {
            clearStoredSupabaseSession()
          }

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
  }, [isDevStepFlowPreview, isPublicStandalonePath])

  function renderWithBuildInfo(content: ReactNode) {
    return (
      <ToastProvider>
        {content}
        {showBuildInfo ? <BuildInfoBadge /> : null}
      </ToastProvider>
    )
  }

  if (isPublicQuoteRequestStandalone) {
    return renderWithBuildInfo(<PublicQuoteRequestPage />)
  }

  if (isPublicGymManualQuizStandalone) {
    return renderWithBuildInfo(<PublicGymManualQuizPage />)
  }

  if (isDevStepFlowPreview) {
    return renderWithBuildInfo(<DevStepFlowPreviewPage />)
  }

  if (isBooting) {
    return renderWithBuildInfo(
      <main className="cc-boot-screen" aria-label="Iniciando CostaClean CRM">
        <div className="cc-boot-screen__wave" aria-hidden="true" />
        <div className="cc-boot-screen__glow cc-boot-screen__glow--one" />
        <div className="cc-boot-screen__glow cc-boot-screen__glow--two" />

        <section className="cc-boot-card">
          <div className="cc-boot-card__brand" aria-hidden="true">
            <img
              src={bootLogoSrc}
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
    return renderWithBuildInfo(
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
    return renderWithBuildInfo(<AuthPage onSignedIn={() => undefined} />)
  }

  return renderWithBuildInfo(
    <div className="cc-app-shell-enter">
      <AppShell
        theme={theme}
        onToggleTheme={toggleTheme}
        accountLabel={session.user.email ?? 'Mi cuenta'}
        isSigningOut={isSigningOut}
        onSignOut={runLogout}
      />
      {themeFeedback ? (
        <div className="cc-theme-toast" role="status" aria-live="polite" aria-atomic="true">
          {themeFeedback}
        </div>
      ) : null}
    </div>
  )
}

export default App
