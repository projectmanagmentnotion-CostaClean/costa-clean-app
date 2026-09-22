import {
  CdpConnection,
  delay,
  evaluateJson,
  findFreePort,
  launchQaBrowser,
  openBrowserSession,
  readAuthStateMetadata,
  waitForCdpEndpoint,
  navigateAndWait,
} from './cdpHarness.mjs'
import { loadSupabasePublicEnv } from '../qaCleanupRegistry.mjs'
import { assertN2QaIdentity, assertN2QaProjectUrl } from '../n2FinancialQaReadinessCore.mjs'

export async function recoverAuthenticatedQaSession(rootDir = process.cwd()) {
  const { supabaseUrl, supabaseAnonKey, available } = await loadSupabasePublicEnv(rootDir)
  if (!available) throw new Error('N2_QA_PUBLIC_SUPABASE_ENV_MISSING')

  const projectRef = assertN2QaProjectUrl(supabaseUrl)
  const metadata = await readAuthStateMetadata(`${rootDir}/.auth/costa-clean-storage-state.json`)
  let appUrl
  try {
    appUrl = new URL(metadata.appUrl)
  } catch {
    throw new Error('N2_QA_AUTH_APP_URL_INVALID')
  }
  if (appUrl.protocol !== 'http:' || appUrl.hostname !== '127.0.0.1') {
    throw new Error('N2_QA_AUTH_APP_ORIGIN_REJECTED')
  }

  const port = await findFreePort()
  const browser = await launchQaBrowser({
    executablePath: metadata.executablePath,
    profileDir: metadata.profileDir,
    remoteDebuggingPort: port,
    startUrl: metadata.appUrl,
    headless: false,
  })
  const endpoint = await waitForCdpEndpoint(browser.remoteDebuggingPort, 20_000)
  const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)

  try {
    await connection.connect()
    const page = await openBrowserSession(connection, metadata.appUrl)
    await delay(1_000)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = await evaluateJson(connection, page.sessionId, `(() => {
        const key = Object.keys(localStorage).find((item) => item.startsWith('sb-') && item.endsWith('-auth-token'))
        if (!key) return null
        try {
          const session = JSON.parse(localStorage.getItem(key) || 'null')
          return session?.access_token || session?.currentSession?.access_token || null
        } catch {
          return null
        }
      })()`)

      if (typeof token !== 'string' || token.length < 20) throw new Error('N2_QA_SESSION_NOT_PRESENT')
      const identity = assertN2QaIdentity({ supabaseUrl, accessToken: token })
      if (identity.projectRef !== projectRef) throw new Error('N2_QA_PROJECT_REF_MISMATCH')

      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const user = await response.json()
        if (typeof user?.id !== 'string') throw new Error('N2_QA_IDENTITY_NOT_PRESENT')
        return {
          accessToken: token,
          supabaseUrl,
          supabaseAnonKey,
          projectRef,
          authenticatedUserPresent: true,
        }
      }

      if (response.status !== 401 || attempt === 2) throw new Error('N2_QA_AUTH_SESSION_REJECTED')
      await navigateAndWait(connection, page.sessionId, metadata.appUrl, 1_500)
    }

    throw new Error('N2_QA_AUTH_SESSION_REJECTED')
  } finally {
    await connection.close()
  }
}
