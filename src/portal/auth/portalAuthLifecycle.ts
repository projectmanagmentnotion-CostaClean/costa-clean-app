import type {
  PortalAccessResolution,
  PortalAuthActionResult,
  PortalLifecycleAdapter,
  PortalLifecycleResolution,
} from '../contracts'

export type PortalAuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'PASSWORD_RECOVERY'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'MFA_CHALLENGE_VERIFIED'

export interface PortalSessionSnapshot {
  userId: string
}

export type PortalProviderFailure =
  | 'auth'
  | 'configuration'
  | 'network'
  | 'unknown'

export type PortalProviderResult<Value> =
  | { ok: true; value: Value }
  | { ok: false; reason: PortalProviderFailure }

export interface PortalAuthProvider {
  clearStoredSession(): void
  getSession(): Promise<PortalProviderResult<PortalSessionSnapshot | null>>
  onAuthStateChange(
    listener: (event: PortalAuthEvent | string, session: PortalSessionSnapshot | null) => void,
  ): () => void
  requestPasswordRecovery(email: string): Promise<PortalProviderResult<null>>
  resolveSelfAccess(): Promise<PortalProviderResult<PortalAccessResolution>>
  sanitizeRecoveryUrl(): void
  signIn(email: string, password: string): Promise<PortalProviderResult<null>>
  signOut(): Promise<PortalProviderResult<null>>
  updatePassword(password: string): Promise<PortalProviderResult<null>>
}

const genericLifecycleError =
  'No hemos podido preparar el área de clientes. Inténtalo de nuevo más tarde.'
const genericCredentialsMessage =
  'No hemos podido iniciar sesión. Revisa los datos o inténtalo de nuevo.'
const genericActionMessage =
  'No hemos podido completar la operación. Inténtalo de nuevo.'
const recoveryNeutralMessage =
  'Si la cuenta existe, recibirás instrucciones para continuar de forma segura.'

function safeResult(ok: boolean, message: string): PortalAuthActionResult {
  return { ok, message }
}

export function createPortalAuthLifecycle(
  provider: PortalAuthProvider,
): PortalLifecycleAdapter {
  let active = false
  let authEventObserved = false
  let currentUserId: string | null = null
  let emitResolution: ((resolution: PortalLifecycleResolution) => void) | null = null
  let epoch = 0
  let hasResolvedAccess = false
  let isResolvingAccess = false
  let isRecoverySession = false
  let signOutRequested = false
  let unsubscribeAuth: (() => void) | null = null
  const pendingActions = new Set<string>()

  function emit(resolution: PortalLifecycleResolution) {
    if (active) emitResolution?.(resolution)
  }

  function invalidateAccess() {
    epoch += 1
    hasResolvedAccess = false
    isResolvingAccess = false
  }

  function closeUnknownState() {
    invalidateAccess()
    emit({ status: 'error', message: genericLifecycleError })
  }

  function applySignedOut(expired: boolean) {
    invalidateAccess()
    currentUserId = null
    isRecoverySession = false
    signOutRequested = false
    provider.clearStoredSession()
    emit({ status: expired ? 'session_expired' : 'unauthenticated' })
  }

  function scheduleAccessResolution(force: boolean) {
    if (!active || !currentUserId || isRecoverySession) return
    if (!force && (hasResolvedAccess || isResolvingAccess)) return

    const expectedUserId = currentUserId
    const resolutionEpoch = ++epoch
    hasResolvedAccess = false
    isResolvingAccess = true
    emit({ status: 'booting' })

    queueMicrotask(() => {
      void provider.resolveSelfAccess().then((result) => {
        if (
          !active
          || resolutionEpoch !== epoch
          || currentUserId !== expectedUserId
        ) {
          return
        }

        isResolvingAccess = false

        if (!result.ok) {
          if (result.reason === 'auth') {
            applySignedOut(true)
            return
          }
          emit({ status: 'error', message: genericLifecycleError })
          return
        }

        hasResolvedAccess = true
        emit(result.value)
      })
    })
  }

  function applySession(
    session: PortalSessionSnapshot | null,
    options: { forceResolution: boolean; missingMeansExpired: boolean },
  ) {
    if (!session) {
      const hadSession = currentUserId !== null || hasResolvedAccess || isRecoverySession
      applySignedOut(options.missingMeansExpired && hadSession)
      return
    }

    if (!session.userId) {
      closeUnknownState()
      return
    }

    if (currentUserId !== session.userId) {
      invalidateAccess()
      currentUserId = session.userId
      isRecoverySession = false
    }

    scheduleAccessResolution(options.forceResolution)
  }

  function handleAuthEvent(
    event: PortalAuthEvent | string,
    session: PortalSessionSnapshot | null,
  ) {
    if (!active) return
    authEventObserved = true

    if (event === 'SIGNED_OUT') {
      const expired = !signOutRequested
      signOutRequested = false
      applySignedOut(expired)
      return
    }

    if (event === 'PASSWORD_RECOVERY') {
      if (!session?.userId) {
        applySignedOut(true)
        return
      }

      invalidateAccess()
      currentUserId = session.userId
      isRecoverySession = true
      emit({ status: 'password_recovery' })
      queueMicrotask(() => {
        if (active && isRecoverySession) provider.sanitizeRecoveryUrl()
      })
      return
    }

    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      applySession(session, {
        forceResolution: false,
        missingMeansExpired: false,
      })
      return
    }

    if (
      event === 'TOKEN_REFRESHED'
      || event === 'USER_UPDATED'
      || event === 'MFA_CHALLENGE_VERIFIED'
    ) {
      if (isRecoverySession && event === 'USER_UPDATED') return
      applySession(session, {
        forceResolution: true,
        missingMeansExpired: true,
      })
      return
    }

    closeUnknownState()
  }

  async function refreshSession(forceResolution: boolean) {
    if (!active) return

    const refreshEpoch = ++epoch
    hasResolvedAccess = false
    isResolvingAccess = false
    emit({ status: 'booting' })

    const result = await provider.getSession()
    if (!active || refreshEpoch !== epoch) return

    if (!result.ok) {
      if (result.reason === 'auth') {
        applySignedOut(true)
        return
      }
      emit({ status: 'error', message: genericLifecycleError })
      return
    }

    applySession(result.value, {
      forceResolution,
      missingMeansExpired: currentUserId !== null,
    })
  }

  async function runAction(
    key: string,
    operation: () => Promise<PortalAuthActionResult>,
    duplicateResult: PortalAuthActionResult,
  ) {
    if (pendingActions.has(key)) return duplicateResult
    pendingActions.add(key)

    try {
      return await operation()
    } finally {
      pendingActions.delete(key)
    }
  }

  return {
    start(onResolution) {
      unsubscribeAuth?.()
      active = true
      authEventObserved = false
      emitResolution = onResolution
      currentUserId = null
      isRecoverySession = false
      signOutRequested = false
      invalidateAccess()
      emit({ status: 'booting' })

      unsubscribeAuth = provider.onAuthStateChange(handleAuthEvent)
      const bootstrapEpoch = epoch

      void provider.getSession().then((result) => {
        if (!active || bootstrapEpoch !== epoch || authEventObserved) return

        if (!result.ok) {
          emit({ status: 'error', message: genericLifecycleError })
          return
        }

        applySession(result.value, {
          forceResolution: false,
          missingMeansExpired: false,
        })
      })

      return () => {
        active = false
        invalidateAccess()
        unsubscribeAuth?.()
        unsubscribeAuth = null
        emitResolution = null
      }
    },

    retry() {
      void refreshSession(true)
    },

    signIn(email, password) {
      return runAction(
        'signIn',
        async () => {
          const result = await provider.signIn(email.trim(), password)
          if (!result.ok) return safeResult(false, genericCredentialsMessage)

          void refreshSession(false)
          return safeResult(true, 'Acceso validado. Comprobando permisos.')
        },
        safeResult(false, genericCredentialsMessage),
      )
    },

    requestPasswordRecovery(email) {
      return runAction(
        'recovery',
        async () => {
          await provider.requestPasswordRecovery(email.trim())
          return safeResult(true, recoveryNeutralMessage)
        },
        safeResult(true, recoveryNeutralMessage),
      )
    },

    updatePassword(password) {
      return runAction(
        'updatePassword',
        async () => {
          if (!isRecoverySession) return safeResult(false, genericActionMessage)

          const updateResult = await provider.updatePassword(password)
          if (!updateResult.ok) return safeResult(false, genericActionMessage)

          signOutRequested = true
          const signOutResult = await provider.signOut()
          if (!signOutResult.ok) {
            signOutRequested = false
            closeUnknownState()
            return safeResult(false, genericActionMessage)
          }

          if (currentUserId !== null || isRecoverySession || signOutRequested) {
            applySignedOut(false)
          }
          return safeResult(true, 'Contraseña actualizada. Inicia sesión de nuevo.')
        },
        safeResult(false, genericActionMessage),
      )
    },

    signOut() {
      return runAction(
        'signOut',
        async () => {
          invalidateAccess()
          emit({ status: 'booting' })
          signOutRequested = true

          const result = await provider.signOut()
          if (!result.ok) {
            signOutRequested = false
            emit({ status: 'error', message: genericLifecycleError })
            return safeResult(false, genericActionMessage)
          }

          if (currentUserId !== null || isRecoverySession || signOutRequested) {
            applySignedOut(false)
          }
          return safeResult(true, 'Sesión cerrada.')
        },
        safeResult(false, genericActionMessage),
      )
    },
  }
}
