import fs from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'

const LOCAL_APP_CANDIDATES = [
  'http://127.0.0.1:4173/',
  'http://127.0.0.1:5173/',
]

const DEFAULT_VIEWS = [
  'home',
  'clients',
  'properties',
  'quotes',
  'jobs',
  'invoices',
  'expenses',
  'payments',
  'fiscal_closing',
]

const DEFAULT_FLOW_SCENARIOS = [
  { id: 'quotes-create', viewId: 'quotes', actionLabel: 'Nuevo presupuesto', title: 'Nuevo presupuesto' },
  { id: 'jobs-create', viewId: 'jobs', actionLabel: 'Registrar servicio', title: 'Nuevo servicio' },
  { id: 'expenses-create', viewId: 'expenses', actionLabel: 'Nuevo gasto', title: 'Nuevo gasto' },
  { id: 'payments-create', viewId: 'payments', actionLabel: 'Registrar cobro', title: 'Registrar cobro' },
]

const DEFAULT_VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'desktop', width: 1366, height: 900 },
]

const LOGIN_MARKERS = [
  'iniciar sesion',
  'inicia sesion',
  'login',
  'acceder',
  'correo',
  'contraseña',
  'contrasena',
]

const APP_SHELL_MARKERS = ['Inicio', 'Clientes', 'Servicios', 'Facturas', 'Mas']

const ERROR_MARKERS = [
  'unexpected application error',
  'something went wrong',
  'error boundary',
  'ha ocurrido un error',
]

const BROWSER_CANDIDATES = [
  {
    id: 'edge',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  },
  {
    id: 'edge',
    executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  },
  {
    id: 'chrome',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  },
  {
    id: 'chrome',
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  },
]

export function getQaPaths(rootDir = process.cwd()) {
  return {
    authDir: path.resolve(rootDir, '.auth'),
    profileDir: path.resolve(rootDir, '.auth', 'qa-browser-profile'),
    stateFile: path.resolve(rootDir, '.auth', 'costa-clean-storage-state.json'),
    screenshotsDir: path.resolve(rootDir, 'qa-screenshots', 'private'),
    reportsDir: path.resolve(rootDir, 'qa-reports', 'private'),
  }
}

export async function detectBrowserExecutable() {
  if (process.env.QA_BROWSER_PATH) {
    return {
      id: 'custom',
      executablePath: process.env.QA_BROWSER_PATH,
    }
  }

  for (const candidate of BROWSER_CANDIDATES) {
    try {
      await fs.access(candidate.executablePath)
      return candidate
    } catch {
      continue
    }
  }

  throw new Error('No local Edge/Chrome executable was found for the QA harness.')
}

export async function detectLocalAppUrl() {
  for (const candidate of LOCAL_APP_CANDIDATES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      const response = await fetch(candidate, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.status >= 200 && response.status < 500) {
        return candidate
      }
    } catch {
      continue
    }
  }

  throw new Error('Local app is not reachable at http://127.0.0.1:4173/ or http://127.0.0.1:5173/.')
}

export async function ensureQaDirectories(paths) {
  await fs.mkdir(paths.authDir, { recursive: true })
  await fs.mkdir(paths.profileDir, { recursive: true })
  await fs.mkdir(paths.screenshotsDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })
}

export async function findFreePort() {
  const server = net.createServer()
  return await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not resolve a free TCP port.'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

export async function launchQaBrowser({
  executablePath,
  profileDir,
  remoteDebuggingPort,
  startUrl,
  headless = false,
}) {
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=Translate,AutomationControlled',
    '--new-window',
    startUrl,
  ]

  if (headless) {
    args.unshift('--headless=new')
  }

  const child = spawn(executablePath, args, {
    stdio: 'ignore',
    windowsHide: false,
  })

  child.unref()
  return child
}

async function waitForJson(url, timeoutMs) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      await delay(300)
    }
  }

  throw new Error(`Timed out waiting for CDP endpoint ${url}: ${lastError?.message ?? 'unknown error'}`)
}

export async function waitForCdpEndpoint(port, timeoutMs = 15000) {
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, timeoutMs)
  return {
    version,
    webSocketDebuggerUrl: version.webSocketDebuggerUrl,
  }
}

export class CdpConnection {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.nextId = 1
    this.pending = new Map()
    this.eventListeners = new Map()
    this.socket = null
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl)
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })

    this.socket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data))
      if (payload.id) {
        const pending = this.pending.get(payload.id)
        if (!pending) return
        this.pending.delete(payload.id)
        if (payload.error) {
          pending.reject(new Error(payload.error.message))
        } else {
          pending.resolve(payload.result ?? {})
        }
        return
      }

      const listeners = this.eventListeners.get(payload.method)
      if (!listeners) return
      for (const listener of listeners) {
        listener(payload.params ?? {})
      }
    })
  }

  async close() {
    if (!this.socket) return
    this.socket.close()
    this.socket = null
  }

  on(method, listener) {
    const listeners = this.eventListeners.get(method) ?? []
    listeners.push(listener)
    this.eventListeners.set(method, listeners)
  }

  async send(method, params = {}, sessionId) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('CDP connection is not open.')
    }

    const id = this.nextId++
    const message = {
      id,
      method,
      params,
    }

    if (sessionId) {
      message.sessionId = sessionId
    }

    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify(message))
    })
  }
}

export async function openBrowserSession(connection, initialUrl) {
  const { targetId } = await connection.send('Target.createTarget', { url: initialUrl })
  const { sessionId } = await connection.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  })

  await connection.send('Page.enable', {}, sessionId)
  await connection.send('Runtime.enable', {}, sessionId)
  await connection.send('Network.enable', {}, sessionId)
  return { targetId, sessionId }
}

export async function closeBrowserSession(connection, targetId, sessionId) {
  try {
    await connection.send('Target.closeTarget', { targetId })
  } catch {
    // Ignore close failures while shutting down a local QA browser.
  }

  try {
    await connection.send('Target.detachFromTarget', { sessionId })
  } catch {
    // Ignore detach failures while shutting down a local QA browser.
  }
}

export async function configureViewport(connection, sessionId, viewport) {
  await connection.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 430,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  }, sessionId)

  await connection.send('Emulation.setVisibleSize', {
    width: viewport.width,
    height: viewport.height,
  }, sessionId)
}

export async function navigateAndWait(connection, sessionId, url, waitMs = 1200) {
  await connection.send('Page.navigate', { url }, sessionId)
  await waitForLoadEvent(connection, sessionId, 15000)
  await delay(waitMs)
}

export async function waitForViewReady(connection, sessionId, viewId, timeoutMs = 8000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const ready = await evaluateJson(connection, sessionId, `(() => {
      const bodyText = document.body?.innerText ?? ''
      const loadingDashboard = bodyText.includes('Preparando panel de control')
      const header = document.querySelector('h1, header h1, [data-page-header] h1')

      if (${JSON.stringify(viewId)} === 'home') {
        return !loadingDashboard && Boolean(header)
      }

      return true
    })()`)

    if (ready) {
      return true
    }

    await delay(400)
  }

  return false
}

async function waitForLoadEvent(connection, sessionId, timeoutMs) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for page load after ${timeoutMs} ms.`))
    }, timeoutMs)

    const handler = (params) => {
      if (params.sessionId && params.sessionId !== sessionId) return
      clearTimeout(timeout)
      resolve()
    }

    connection.on('Page.loadEventFired', handler)
  })
}

export async function evaluateJson(connection, sessionId, expression) {
  const result = await connection.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId)

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Runtime evaluation failed.')
  }

  return result.result?.value
}

export async function captureScreenshot(connection, sessionId, outputPath) {
  const screenshot = await connection.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  }, sessionId)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'))
}

export async function writeAuthStateMetadata({
  stateFile,
  browserId,
  executablePath,
  appUrl,
  profileDir,
}) {
  const payload = {
    provider: 'chrome-cdp-profile',
    browserId,
    executablePath,
    appUrl,
    profileDir,
    createdAt: new Date().toISOString(),
    note: 'This file stores only local QA metadata. Auth secrets remain inside the ignored browser profile directory.',
  }

  await fs.mkdir(path.dirname(stateFile), { recursive: true })
  await fs.writeFile(stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

export async function readAuthStateMetadata(stateFile) {
  const raw = await fs.readFile(stateFile, 'utf8')
  return JSON.parse(raw)
}

export async function detectAuthenticatedShell(connection, sessionId) {
  return await evaluateJson(connection, sessionId, `(() => {
    const bodyText = document.body?.innerText ?? '';
    const lower = bodyText.toLowerCase();
    const hasPasswordField = Boolean(document.querySelector('input[type="password"]'));
    const hasEmailField = Boolean(document.querySelector('input[type="email"]'));
    const loginMarkers = ${JSON.stringify(LOGIN_MARKERS)};
    const shellMarkers = ${JSON.stringify(APP_SHELL_MARKERS)};
    const loginMarkerCount = loginMarkers.filter((marker) => lower.includes(marker)).length;
    const shellMarkerCount = shellMarkers.filter((marker) => bodyText.includes(marker)).length;
    return {
      href: location.href,
      title: document.title,
      hasPasswordField,
      hasEmailField,
      loginMarkerCount,
      shellMarkerCount,
      authenticated: shellMarkerCount >= 2 && !hasPasswordField,
    };
  })()`)
}

export async function collectViewAudit(connection, sessionId, viewId, viewport) {
  return await evaluateJson(connection, sessionId, `(() => {
    const tolerance = 1;
    const bodyText = document.body?.innerText ?? '';
    const lower = bodyText.toLowerCase();
    const navNodes = Array.from(document.querySelectorAll('nav, [role="navigation"]'));
    const navRects = navNodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        text: (node.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 140),
      };
    });
    const header = document.querySelector('h1, header h1, [data-page-header] h1');
    const headerRect = header ? header.getBoundingClientRect() : null;
    const moneyCandidates = Array.from(document.querySelectorAll('strong, h1, h2, h3, p, span'))
      .map((node) => ({
        text: (node.textContent ?? '').trim(),
        rect: node.getBoundingClientRect(),
      }))
      .filter((item) => item.text.includes('€') && item.rect.top < window.innerHeight)
      .slice(0, 10);
    const fiscalRealAmountCard = document.querySelector('[data-qa="fiscal-real-amount"]');
    const fiscalRealAmountRect = fiscalRealAmountCard ? fiscalRealAmountCard.getBoundingClientRect() : null;
    const shellMarkers = ${JSON.stringify(APP_SHELL_MARKERS)};
    const errorMarkers = ${JSON.stringify(ERROR_MARKERS)};
    const shellMarkerCount = shellMarkers.filter((marker) => bodyText.includes(marker)).length;
    const errorMarkerCount = errorMarkers.filter((marker) => lower.includes(marker)).length;
    const bottomNavVisible = navRects.some((rect) => rect.bottom >= window.innerHeight - 120 && rect.top < window.innerHeight);
    const activeMainSection = bodyText.slice(0, 900);
    const firstMoney = moneyCandidates[0] ? {
      text: moneyCandidates[0].text,
      top: moneyCandidates[0].rect.top,
    } : null;

    const checks = {
      noLoginScreen: shellMarkerCount >= 2 && !document.querySelector('input[type="password"]'),
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + tolerance,
      appShellVisible: navNodes.length > 0,
      headerVisible: Boolean(headerRect && headerRect.top < window.innerHeight && headerRect.bottom > 0),
      bottomNavVisible: ${viewport.width} <= 430 ? bottomNavVisible : true,
      noErrorBoundaryVisible: errorMarkerCount === 0,
      invoiceControlHidden: ${JSON.stringify(viewId)} === 'invoices' ? !bodyText.includes('Control de numeracion') && !bodyText.includes('Debug fiscal') : true,
      invoiceDebugVisible: ${JSON.stringify(viewId)} === 'invoices-debug' ? bodyText.includes('Control de numeracion') && bodyText.includes('Debug fiscal') : true,
      homeAgendaCollapsed: ${JSON.stringify(viewId)} === 'home' ? !bodyText.includes('Sin agenda inmediata') : true,
      fiscalRealAmountVisible: ${JSON.stringify(viewId)} === 'fiscal_closing'
        ? Boolean(
          fiscalRealAmountRect
          && fiscalRealAmountRect.top < window.innerHeight
          && fiscalRealAmountRect.bottom > 0
        )
        : true,
    };

    return {
      viewId: ${JSON.stringify(viewId)},
      viewport: ${JSON.stringify(viewport)},
      url: location.href,
      title: document.title,
      headerText: header?.textContent?.trim() ?? null,
      headerRect,
      firstMoney,
      fiscalRealAmountRect,
      navPreview: navRects,
      shellMarkerCount,
      checks,
      snippets: {
        firstViewportText: activeMainSection,
        debugVisible: bodyText.includes('Debug fiscal'),
        numberingVisible: bodyText.includes('Control de numeracion'),
        zeroEuroVisible: bodyText.includes('0,00 €'),
      },
    };
  })()`)
}

export async function collectActionFlowAudit(connection, sessionId, scenario, viewport) {
  await evaluateJson(connection, sessionId, `(() => {
    const normalize = (value) => (value ?? '').replace(/\\s+/g, ' ').trim()
    const button = Array.from(document.querySelectorAll('button')).find((node) => normalize(node.textContent) === ${JSON.stringify(scenario.actionLabel)})
    if (!button) return false
    button.click()
    return true
  })()`)

  await delay(1200)

  return await evaluateJson(connection, sessionId, `(() => {
    const normalize = (value) => (value ?? '').replace(/\\s+/g, ' ').trim()
    const panel = document.querySelector('[data-qa="action-flow-panel"]')
    const panelRect = panel ? panel.getBoundingClientRect() : null
    const flowSurface = panel?.querySelector('[data-qa="fullscreen-step-flow"]') ?? null
    const titleNode = panel?.querySelector('#cc-action-flow-title, h1, h2') ?? null
    const fieldCandidates = Array.from(panel?.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? [])
    const firstVisibleField = fieldCandidates.find((node) => {
      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.top < window.innerHeight
        && rect.bottom > 0
    }) ?? null
    const firstVisibleFieldRect = firstVisibleField ? firstVisibleField.getBoundingClientRect() : null

    return {
      viewId: ${JSON.stringify(scenario.id)},
      viewport: ${JSON.stringify(viewport)},
      url: location.href,
      title: document.title,
      headerText: titleNode ? normalize(titleNode.textContent) : null,
      checks: {
        actionFlowVisible: Boolean(panelRect && panelRect.top < window.innerHeight && panelRect.bottom > 0),
        actionFlowTitleVisible: Boolean(titleNode && normalize(titleNode.textContent).includes(${JSON.stringify(scenario.title)})),
        actionFlowFirstFieldVisible: Boolean(firstVisibleFieldRect),
        actionFlowNoHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        actionFlowStepFlowVisible: Boolean(flowSurface),
      },
      snippets: {
        firstViewportText: (panel?.innerText ?? '').slice(0, 900),
      },
    }
  })()`)
}

export async function writeMarkdownReport(reportPath, report) {
  const lines = [
    '# Authenticated Visual QA Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- App URL: ${report.appUrl}`,
    `- Browser: ${report.browserId}`,
    `- Profile directory: ${report.profileDir}`,
    '',
    '## Summary',
    '',
    `- Total checks: ${report.summary.totalChecks}`,
    `- Passed: ${report.summary.passedChecks}`,
    `- Failed: ${report.summary.failedChecks}`,
    '',
    '## Runs',
    '',
  ]

  for (const result of report.results) {
    const failedChecks = Object.entries(result.checks).filter(([, passed]) => !passed).map(([key]) => key)
    lines.push(`### ${result.viewport.id} / ${result.viewId}`)
    lines.push('')
    lines.push(`- URL: ${result.url}`)
    lines.push(`- Header: ${result.headerText ?? 'n/a'}`)
    lines.push(`- Screenshot: ${result.screenshotPath ?? 'not generated'}`)
    lines.push(`- Failed checks: ${failedChecks.length > 0 ? failedChecks.join(', ') : 'none'}`)
    lines.push('')
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8')
}

export function summarizeResults(results) {
  let totalChecks = 0
  let passedChecks = 0

  for (const result of results) {
    for (const passed of Object.values(result.checks)) {
      totalChecks += 1
      if (passed) {
        passedChecks += 1
      }
    }
  }

  return {
    totalChecks,
    passedChecks,
    failedChecks: totalChecks - passedChecks,
  }
}

export function buildViewUrl(appUrl, viewId) {
  const url = new URL(appUrl)
  const normalizedViewId = viewId === 'invoices-debug' ? 'invoices' : viewId
  url.searchParams.set('view', normalizedViewId)
  if (viewId === 'invoices-debug') {
    url.searchParams.set('debugInvoiceFiscal', '1')
  }
  return url.toString()
}

export function defaultViews() {
  return [...DEFAULT_VIEWS, 'invoices-debug']
}

export function defaultFlowScenarios() {
  return DEFAULT_FLOW_SCENARIOS.map((scenario) => ({ ...scenario }))
}

export function defaultViewports() {
  return DEFAULT_VIEWPORTS.map((viewport) => ({ ...viewport }))
}

export function formatTimestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
}

export async function delay(timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs))
}
