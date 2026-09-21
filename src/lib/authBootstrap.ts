const RECOVERABLE_AUTH_BOOTSTRAP_ERRORS = [
  'failed to fetch',
  'networkerror',
  'load failed',
  'lock broken by another request',
] as const

export function isRecoverableAuthBootstrapError(message: string) {
  const normalizedMessage = message.trim().toLowerCase()
  return RECOVERABLE_AUTH_BOOTSTRAP_ERRORS.some((error) => normalizedMessage.includes(error))
}

export function shouldClearStoredSupabaseSession(event: string) {
  return event === 'SIGNED_OUT'
}
