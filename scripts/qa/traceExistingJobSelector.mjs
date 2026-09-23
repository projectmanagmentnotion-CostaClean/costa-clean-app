import { CdpConnection, waitForCdpEndpoint, openBrowserSession, waitForShellStable, readAuthStateMetadata, getQaPaths, buildViewUrl, safeClickByText, delay } from './auth/cdpHarness.mjs'
const runId = process.argv[2]
const marker = `QA_N2_FUNC_${runId}`
const endpoint = await waitForCdpEndpoint(Number(process.env.QA_CDP_PORT ?? 59285), 5000)
const connection = new CdpConnection(endpoint.webSocketDebuggerUrl); await connection.connect()
const appUrl = (await readAuthStateMetadata(getQaPaths(process.cwd()).stateFile)).appUrl
const page = await openBrowserSession(connection, buildViewUrl(appUrl, 'invoices')); await waitForShellStable(connection, page.sessionId, 15000)
let clicked = false
for (let attempt = 0; attempt < 20 && !clicked; attempt += 1) {
  clicked = await safeClickByText(connection, page.sessionId, 'Nueva factura')
  if (!clicked) await delay(150)
}
await delay(1200)
const result = await connection.send('Runtime.evaluate', { expression: `(async () => {
  const selects = () => Array.from(document.querySelectorAll('.v3-step-flow select, [data-qa="action-flow-panel"] select'))
  const labels = () => selects().map((s) => ({ label: (s.previousElementSibling?.textContent ?? s.parentElement?.textContent ?? '').trim(), value: s.value, options: Array.from(s.options).map((o) => ({ value:o.value, text:o.textContent })) }))
  const all = selects(); const client = all.find((s) => (s.previousElementSibling?.textContent ?? '').toLowerCase().includes('cliente')); const property = all.find((s) => (s.previousElementSibling?.textContent ?? '').toLowerCase().includes('inmueble'))
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  const clientOption = Array.from(client?.options ?? []).find((o) => o.textContent.includes(${JSON.stringify(marker)}))
  if (client && clientOption) { setter.call(client, clientOption.value); client.dispatchEvent(new Event('change', { bubbles:true })) }
  await new Promise((r) => setTimeout(r, 1400))
  const propertyOption = Array.from(property?.options ?? []).find((o) => o.textContent.includes(${JSON.stringify(marker)}))
  if (property && propertyOption) { setter.call(property, propertyOption.value); property.dispatchEvent(new Event('change', { bubbles:true })) }
  const continueButton = Array.from(document.querySelectorAll('.v3-step-flow button, [data-qa="action-flow-panel"] button')).find((node) => ['Continuar', 'Siguiente'].includes((node.textContent ?? '').trim()))
  continueButton?.click()
  await new Promise((r) => setTimeout(r, 900))
  const originSelect = Array.from(document.querySelectorAll('.v3-step-flow select, [data-qa="action-flow-panel"] select')).find((s) => ((s.previousElementSibling?.textContent ?? '') + ' ' + (s.parentElement?.textContent ?? '')).toLowerCase().includes('origen del servicio'))
  if (originSelect) { setter.call(originSelect, 'EXISTING_JOB'); originSelect.dispatchEvent(new Event('change', { bubbles:true })); await new Promise((r) => setTimeout(r, 1200)) }
  const serviceSelect = Array.from(document.querySelectorAll('.v3-step-flow select, [data-qa="action-flow-panel"] select')).find((s) => ((s.previousElementSibling?.textContent ?? '') + ' ' + (s.parentElement?.textContent ?? '')).toLowerCase().includes('servicio existente'))
  const serviceOption = Array.from(serviceSelect?.options ?? []).find((o) => o.value)
  if (serviceSelect && serviceOption) { setter.call(serviceSelect, serviceOption.value); serviceSelect.dispatchEvent(new Event('change', { bubbles:true })) }
  const nextOrigin = Array.from(document.querySelectorAll('.v3-step-flow button, [data-qa="action-flow-panel"] button')).find((node) => ['Continuar', 'Siguiente'].includes((node.textContent ?? '').trim()))
  nextOrigin?.click()
  await new Promise((r) => setTimeout(r, 900))
  const newInvoiceButton = Array.from(document.querySelectorAll('button')).find((node) => (node.textContent ?? '').trim() === '+ Nueva factura')
  return { clicked: ${JSON.stringify(true)}, afterContext: labels(), clientSelected: client?.value ?? null, propertySelected: property?.value ?? null, originSelected: originSelect?.value ?? null, serviceSelected: serviceSelect?.value ?? null, url: location.href, body: document.body.innerText.slice(0, 2200), buttonTexts: Array.from(document.querySelectorAll('button')).map((node) => node.textContent?.trim()).filter(Boolean).slice(-25), newInvoiceButton: newInvoiceButton ? { outerHTML: newInvoiceButton.outerHTML, rect: newInvoiceButton.getBoundingClientRect().toJSON() } : null }
})()`, returnByValue:true, awaitPromise:true }, page.sessionId)
console.log(JSON.stringify({ clicked, ...result.result?.value }, null, 2))
await connection.send('Page.close', {}, page.sessionId).catch(()=>{}); await connection.close()
