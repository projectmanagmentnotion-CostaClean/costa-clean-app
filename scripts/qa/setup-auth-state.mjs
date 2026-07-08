import path from 'node:path'
import {
  CdpConnection,
  detectAuthenticatedShell,
  detectBrowserExecutable,
  detectLocalAppUrl,
  ensureQaDirectories,
  findFreePort,
  getQaPaths,
  launchQaBrowser,
  openBrowserSession,
  waitForCdpEndpoint,
  writeAuthStateMetadata,
  closeBrowserSession,
  delay,
} from './auth/cdpHarness.mjs'

const rootDir = process.cwd()
const qaPaths = getQaPaths(rootDir)
const setupTimeoutMs = Number(process.env.QA_AUTH_SETUP_TIMEOUT_MS ?? 300000)

async function main() {
  const browser = await detectBrowserExecutable()
  const appUrl = await detectLocalAppUrl()
  await ensureQaDirectories(qaPaths)
  const remoteDebuggingPort = await findFreePort()

  await launchQaBrowser({
    executablePath: browser.executablePath,
    profileDir: qaPaths.profileDir,
    remoteDebuggingPort,
    startUrl: appUrl,
    headless: false,
  })

  const endpoint = await waitForCdpEndpoint(remoteDebuggingPort, 20000)
  const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
  await connection.connect()
  const session = await openBrowserSession(connection, appUrl)

  process.stdout.write(
    [
      'QA auth setup started.',
      `Browser: ${browser.id}`,
      `App URL: ${appUrl}`,
      `Profile dir: ${qaPaths.profileDir}`,
      'Log in manually in the opened browser window. This script will save only local metadata, never token contents.',
      `Waiting up to ${Math.round(setupTimeoutMs / 1000)}s for an authenticated shell...`,
      '',
    ].join('\n'),
  )

  const startedAt = Date.now()
  let shellState = null
  while (Date.now() - startedAt < setupTimeoutMs) {
    shellState = await detectAuthenticatedShell(connection, session.sessionId)
    if (shellState.authenticated) {
      break
    }
    await delay(1000)
  }

  if (!shellState?.authenticated) {
    throw new Error(`Manual login was not detected within ${setupTimeoutMs} ms.`)
  }

  await writeAuthStateMetadata({
    stateFile: qaPaths.stateFile,
    browserId: browser.id,
    executablePath: browser.executablePath,
    appUrl,
    profileDir: qaPaths.profileDir,
  })

  process.stdout.write(
    [
      '',
      'Authenticated QA state saved.',
      `State file: ${path.relative(rootDir, qaPaths.stateFile)}`,
      `Profile dir: ${path.relative(rootDir, qaPaths.profileDir)}`,
      'No cookies or token contents were printed.',
      '',
    ].join('\n'),
  )

  await closeBrowserSession(connection, session.targetId, session.sessionId)
  await connection.close()
}

main().catch((error) => {
  console.error(`QA auth setup failed: ${error.message}`)
  process.exitCode = 1
})
