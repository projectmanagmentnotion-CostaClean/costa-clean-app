import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import type {
  PortalAuthActionResult,
  PortalLifecycleAdapter,
} from './contracts'
import type { PortalAuthRoute } from './portalNavigation'
import { PortalBrand } from './PortalBrand'
import { PortalMotionSurface } from './PortalMotionSurface'

interface PortalAuthScreenProps {
  lifecycle: PortalLifecycleAdapter
  route: PortalAuthRoute
  onNavigate: (path: string, replace?: boolean) => void
}

type FormStatus =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'result'; result: PortalAuthActionResult }

const invalidEmailMessage = 'Introduce un email válido.'
const invalidPasswordMessage = 'Introduce tu contraseña.'
const invalidNewPasswordMessage =
  'Usa una contraseña de al menos 12 caracteres.'

export function PortalAuthScreen({
  lifecycle,
  route,
  onNavigate,
}: PortalAuthScreenProps) {
  const screenRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      screenRef.current?.querySelector<HTMLElement>('h1')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route])

  return (
    <main ref={screenRef} className="portal-auth">
      <PortalMotionSurface stateKey={route}>
        <section className="portal-auth__panel" aria-labelledby="portal-auth-title">
          <PortalBrand />
          {route === 'login' ? (
            <LoginForm lifecycle={lifecycle} onNavigate={onNavigate} />
          ) : route === 'recover' ? (
            <RecoveryForm lifecycle={lifecycle} onNavigate={onNavigate} />
          ) : (
            <ResetPasswordForm lifecycle={lifecycle} onNavigate={onNavigate} />
          )}
          <p className="portal-auth__trust">
            Tu sesión protege el acceso; una coincidencia de email nunca vincula
            por sí sola una cuenta a un cliente.
          </p>
        </section>
      </PortalMotionSurface>
    </main>
  )
}

interface AuthFormProps {
  lifecycle: PortalLifecycleAdapter
  onNavigate: (path: string, replace?: boolean) => void
}

function LoginForm({ lifecycle, onNavigate }: AuthFormProps) {
  const [status, setStatus] = useState<FormStatus>({ status: 'idle' })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<'email' | 'password' | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.status === 'submitting') return

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (!isEmail(email)) {
      setFieldError('email')
      focusField(emailRef)
      return
    }
    if (!password) {
      setFieldError('password')
      focusField(passwordRef)
      return
    }

    setFieldError(null)
    setStatus({ status: 'submitting' })
    const result = await lifecycle.signIn(email, password)
    setStatus({ status: 'result', result })
    if (!result.ok) focusResult(resultRef)
  }

  return (
    <div className="portal-auth__content">
      <p className="portal-eyebrow">Acceso protegido</p>
      <h1 id="portal-auth-title" tabIndex={-1}>Entra en tu espacio</h1>
      <p className="portal-auth__intro">
        Consulta el estado de tu acceso de forma segura.
      </p>

      <form className="portal-form" onSubmit={handleSubmit} noValidate>
        <PortalResult status={status} resultRef={resultRef} />
        <label className="portal-field">
          <span>Email</span>
          <input
            ref={emailRef}
            id="portal-login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={fieldError === 'email'}
            aria-describedby={fieldError === 'email' ? 'portal-login-email-error' : undefined}
          />
          {fieldError === 'email' ? (
            <small id="portal-login-email-error" className="portal-field__error">
              {invalidEmailMessage}
            </small>
          ) : null}
        </label>

        <PasswordField
          inputRef={passwordRef}
          id="portal-login-password"
          name="password"
          label="Contraseña"
          autoComplete="current-password"
          showPassword={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          error={fieldError === 'password' ? invalidPasswordMessage : null}
        />

        <button
          type="submit"
          className="portal-button portal-button--primary portal-button--full"
          disabled={status.status === 'submitting'}
        >
          {status.status === 'submitting' ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>

      <button
        type="button"
        className="portal-text-button"
        onClick={() => onNavigate('/portal/recover')}
      >
        He olvidado mi contraseña
      </button>
    </div>
  )
}

function RecoveryForm({ lifecycle, onNavigate }: AuthFormProps) {
  const [status, setStatus] = useState<FormStatus>({ status: 'idle' })
  const [emailError, setEmailError] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.status === 'submitting') return

    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    if (!isEmail(email)) {
      setEmailError(true)
      focusField(emailRef)
      return
    }

    setEmailError(false)
    setStatus({ status: 'submitting' })
    const result = await lifecycle.requestPasswordRecovery(email)
    setStatus({ status: 'result', result })
    focusResult(resultRef)
  }

  return (
    <div className="portal-auth__content">
      <p className="portal-eyebrow">Recuperación segura</p>
      <h1 id="portal-auth-title" tabIndex={-1}>Recupera tu acceso</h1>
      <p className="portal-auth__intro">
        Si existe una cuenta válida, enviaremos las instrucciones necesarias.
      </p>

      <form className="portal-form" onSubmit={handleSubmit} noValidate>
        <PortalResult status={status} resultRef={resultRef} neutral />
        <label className="portal-field">
          <span>Email</span>
          <input
            ref={emailRef}
            id="portal-recovery-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={emailError}
            aria-describedby={emailError ? 'portal-recovery-email-error' : undefined}
          />
          {emailError ? (
            <small id="portal-recovery-email-error" className="portal-field__error">
              {invalidEmailMessage}
            </small>
          ) : null}
        </label>

        <button
          type="submit"
          className="portal-button portal-button--primary portal-button--full"
          disabled={status.status === 'submitting'}
        >
          {status.status === 'submitting' ? 'Enviando…' : 'Enviar instrucciones'}
        </button>
      </form>

      <button
        type="button"
        className="portal-text-button"
        onClick={() => onNavigate('/portal/login')}
      >
        Volver al inicio de sesión
      </button>
    </div>
  )
}

function ResetPasswordForm({ lifecycle, onNavigate }: AuthFormProps) {
  const [status, setStatus] = useState<FormStatus>({ status: 'idle' })
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<'password' | 'confirmation' | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.status === 'submitting') return

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('new-password') ?? '')
    const confirmation = String(formData.get('confirm-password') ?? '')
    if (password.length < 12) {
      setFieldError('password')
      focusField(passwordRef)
      return
    }
    if (confirmation !== password) {
      setFieldError('confirmation')
      focusField(confirmationRef)
      return
    }

    setFieldError(null)
    setStatus({ status: 'submitting' })
    const result = await lifecycle.updatePassword(password)
    if (result.ok) {
      onNavigate('/portal/login', true)
      return
    }
    setStatus({ status: 'result', result })
    focusResult(resultRef)
  }

  return (
    <div className="portal-auth__content">
      <p className="portal-eyebrow">Seguridad de la cuenta</p>
      <h1 id="portal-auth-title" tabIndex={-1}>Crea una nueva contraseña</h1>
      <p className="portal-auth__intro">
        Usa al menos 12 caracteres. Después volverás a iniciar sesión.
      </p>

      <form className="portal-form" onSubmit={handleSubmit} noValidate>
        <PortalResult status={status} resultRef={resultRef} />
        <PasswordField
          inputRef={passwordRef}
          id="portal-new-password"
          name="new-password"
          label="Nueva contraseña"
          autoComplete="new-password"
          showPassword={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          error={fieldError === 'password' ? invalidNewPasswordMessage : null}
        />
        <PasswordField
          inputRef={confirmationRef}
          id="portal-confirm-password"
          name="confirm-password"
          label="Repite la contraseña"
          autoComplete="new-password"
          showPassword={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          error={fieldError === 'confirmation' ? 'Las contraseñas no coinciden.' : null}
        />

        <button
          type="submit"
          className="portal-button portal-button--primary portal-button--full"
          disabled={status.status === 'submitting'}
        >
          {status.status === 'submitting' ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}

interface PasswordFieldProps {
  inputRef: RefObject<HTMLInputElement | null>
  id: string
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  showPassword: boolean
  onToggle: () => void
  error: string | null
}

function PasswordField({
  inputRef,
  id,
  name,
  label,
  autoComplete,
  showPassword,
  onToggle,
  error,
}: PasswordFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="portal-field">
      <label htmlFor={id}>{label}</label>
      <span className="portal-password-field">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          className="portal-password-toggle"
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={showPassword}
          onClick={onToggle}
        >
          {showPassword ? 'Ocultar' : 'Mostrar'}
        </button>
      </span>
      {error ? (
        <small id={errorId} className="portal-field__error">
          {error}
        </small>
      ) : null}
    </div>
  )
}

function PortalResult({
  status,
  resultRef,
  neutral = false,
}: {
  status: FormStatus
  resultRef: RefObject<HTMLDivElement | null>
  neutral?: boolean
}) {
  if (status.status !== 'result') return null

  return (
    <div
      ref={resultRef}
      className={
        status.result.ok || neutral
          ? 'portal-form-result portal-form-result--success'
          : 'portal-form-result portal-form-result--error'
      }
      role={status.result.ok || neutral ? 'status' : 'alert'}
      tabIndex={-1}
    >
      {status.result.message}
    </div>
  )
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
}

function focusField(ref: RefObject<HTMLInputElement | null>) {
  window.requestAnimationFrame(() => ref.current?.focus())
}

function focusResult(ref: RefObject<HTMLDivElement | null>) {
  window.requestAnimationFrame(() => ref.current?.focus())
}
