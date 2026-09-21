export type LogoutOutcome = 'signed-out' | 'failed' | 'already-pending'

interface LogoutFlowOptions {
  signOut: () => Promise<{ error: unknown | null }>
  onPendingChange: (isPending: boolean) => void
  onSignedOut: () => void
}

export function createLogoutFlow({
  signOut,
  onPendingChange,
  onSignedOut,
}: LogoutFlowOptions) {
  let isPending = false

  return async function runLogout(): Promise<LogoutOutcome> {
    if (isPending) {
      return 'already-pending'
    }

    isPending = true
    onPendingChange(true)

    try {
      const { error } = await signOut()

      if (error) {
        return 'failed'
      }

      onSignedOut()
      return 'signed-out'
    } catch {
      return 'failed'
    } finally {
      isPending = false
      onPendingChange(false)
    }
  }
}
