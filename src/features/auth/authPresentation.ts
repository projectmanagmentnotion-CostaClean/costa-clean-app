export function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const normalized = message.trim().toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'El email o la contraseña no son correctos.'
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'No se pudo conectar con el entorno seguro. Revisa la conexión e inténtalo de nuevo.'
  }

  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export function getAuthSubmitLabel(isSubmitting: boolean) {
  return isSubmitting ? 'Accediendo...' : 'Entrar al CRM'
}
