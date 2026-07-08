import fs from 'node:fs/promises'
import path from 'node:path'
import {
  CdpConnection,
  buildViewUrl,
  captureScreenshot,
  closeBrowserSession,
  collectViewAudit,
  configureViewport,
  defaultViews,
  defaultViewports,
  detectBrowserExecutable,
  ensureQaDirectories,
  formatTimestampForPath,
  getQaPaths,
  launchQaBrowser,
  navigateAndWait,
  openBrowserSession,
  readAuthStateMetadata,
  summarizeResults,
  waitForCdpEndpoint,
  findFreePort,
  writeMarkdownReport,
} from './auth/cdpHarness.mjs'

const rootDir = process.cwd()
const qaPaths = getQaPaths(rootDir)

async function main() {
  await ensureQaDirectories(qaPaths)

  let storedState = null
  try {
    storedState = await readAuthStateMetadata(qaPaths.stateFile)
  } catch {
    throw new Error(`Missing auth state at ${path.relative(rootDir, qaPaths.stateFile)}. Run npm run qa:auth:setup first.`)
  }

  const browser = await detectBrowserExecutable()
  const remoteDebuggingPort = await findFreePort()
  const headless = process.argv.includes('--headed') ? false : true

  await launchQaBrowser({
    executablePath: browser.executablePath,
    profileDir: storedState.profileDir,
    remoteDebuggingPort,
    startUrl: storedState.appUrl,
    headless,
  })

  const endpoint = await waitForCdpEndpoint(remoteDebuggingPort, 20000)
  const connection = new CdpConnection(endpoint.webSocketDebuggerUrl)
  await connection.connect()
  const session = await openBrowserSession(connection, storedState.appUrl)

  const timestamp = formatTimestampForPath(new Date())
  const runScreenshotsDir = path.join(qaPaths.screenshotsDir, timestamp)
  const results = []

  for (const viewport of defaultViewports()) {
    await configureViewport(connection, session.sessionId, viewport)
    for (const viewId of defaultViews()) {
      const url = buildViewUrl(storedState.appUrl, viewId)
      await navigateAndWait(connection, session.sessionId, url)
      const audit = await collectViewAudit(connection, session.sessionId, viewId, viewport)
      const screenshotFileName = `${viewport.id}-${viewId}.png`
      const screenshotPath = path.join(runScreenshotsDir, screenshotFileName)
      await captureScreenshot(connection, session.sessionId, screenshotPath)
      results.push({
        ...audit,
        screenshotPath,
      })
      process.stdout.write(`QA ${viewport.id}/${viewId}: ${Object.values(audit.checks).every(Boolean) ? 'ok' : 'check failures'}\n`)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    appUrl: storedState.appUrl,
    browserId: browser.id,
    profileDir: storedState.profileDir,
    summary: summarizeResults(results),
    results,
  }

  const jsonReportPath = path.join(qaPaths.reportsDir, 'authenticated-visual-qa-latest.json')
  const markdownReportPath = path.join(qaPaths.reportsDir, 'authenticated-visual-qa-latest.md')
  await fs.writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeMarkdownReport(markdownReportPath, report)

  process.stdout.write(
    [
      '',
      `Auth QA report written: ${path.relative(rootDir, markdownReportPath)}`,
      `Auth QA JSON written: ${path.relative(rootDir, jsonReportPath)}`,
      `Screenshots written under: ${path.relative(rootDir, runScreenshotsDir)}`,
      '',
    ].join('\n'),
  )

  await closeBrowserSession(connection, session.targetId, session.sessionId)
  await connection.close()
}

main().catch((error) => {
  console.error(`Authenticated visual QA failed: ${error.message}`)
  process.exitCode = 1
})
