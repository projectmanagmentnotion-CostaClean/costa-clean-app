export function parseQaPrivateEnv(text) {
  return Object.fromEntries(
    text.split(/\r?\n/u).flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/u)
      return match ? [[match[1], match[2]]] : []
    }),
  )
}

export function resolveQaAuthCredentials({ processEnv = {}, qaEnv = {}, preferPrivateFile = false } = {}) {
  const fileEmail = qaEnv.COSTACLEAN_QA_AUTH_EMAIL?.trim() || ''
  const filePassword = qaEnv.COSTACLEAN_QA_AUTH_PASSWORD || ''
  const email = preferPrivateFile ? fileEmail : (processEnv.COSTACLEAN_QA_AUTH_EMAIL?.trim() || fileEmail)
  const password = preferPrivateFile ? filePassword : (processEnv.COSTACLEAN_QA_AUTH_PASSWORD || filePassword)
  return { email, password }
}

export function requireQaAuthCredentials(options = {}) {
  const credentials = resolveQaAuthCredentials(options)
  if (!credentials.email || !credentials.password) throw new Error('QA_AUTH_INPUT_MISSING')
  return credentials
}
