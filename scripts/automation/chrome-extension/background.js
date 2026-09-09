/* global chrome */

const bridgeOrigin = 'http://127.0.0.1:4319'
const allowedPaths = new Set(['/api/jobs', '/api/prompts'])

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'costa-bridge-fetch' || !allowedPaths.has(message.path)) return false

  fetch(`${bridgeOrigin}${message.path}`, {
    method: message.method || 'GET',
    headers: message.body ? { 'content-type': 'application/json' } : undefined,
    body: message.body ? JSON.stringify(message.body) : undefined,
  })
    .then(async (response) => ({ ok: response.ok, status: response.status, body: await response.json() }))
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, status: 0, body: { error: error.message } }))

  return true
})
