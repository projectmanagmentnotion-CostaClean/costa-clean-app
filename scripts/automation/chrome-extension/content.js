/* global chrome */

(() => {
  const conversationUrls = [
    'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e',
    'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9988a6-ddac-83eb-9230-300f27403e6b',
  ]
  const conversationUrl = `${location.origin}${location.pathname}`
  const sent = new Set(JSON.parse(sessionStorage.getItem('costaPromptBridgeSent') || '[]'))
  let busy = false
  let contextInvalidated = false
  let intervalId
  let pageGone = false
  let assistantCandidate = ''
  let assistantCandidateSince = 0
  let assistantLastSeen = null
  let tickScheduled = false
  let tickTimer
  const bridgeControlPrefix = '# COSTA CLEAN BRIDGE CONTROL'

  if (!conversationUrls.includes(conversationUrl)) return

  function messages() {
    return [...document.querySelectorAll('[data-message-author-role="user"]')]
      .map((node) => node.innerText.trim())
      .filter(Boolean)
  }

  function assistantMessages() {
    return [...document.querySelectorAll('[data-message-author-role="assistant"]')]
      .map((node) => node.innerText.trim())
      .map((message) => {
        const matches = [...message.matchAll(/#\s*COSTA CLEAN\b/gi)]
        const lastMatch = matches.at(-1)
        return lastMatch ? message.slice(lastMatch.index).trim() : ''
      })
      .filter(Boolean)
  }

  function isCodexPrompt(value) {
    return /^#\s*COSTA CLEAN\b/iu.test(value.trim())
  }

  function composer() {
    return document.querySelector('#prompt-textarea, textarea[placeholder], [contenteditable="true"][role="textbox"], [contenteditable="true"]')
  }

  function setComposer(value) {
    const target = composer()
    if (!target) throw new Error('ChatGPT composer not found.')
    target.focus()
    if (target.matches('[contenteditable="true"]')) {
      target.textContent = ''
      document.execCommand('insertText', false, value)
      target.textContent = value
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    } else {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(target, value)
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  function bridgeFetch(path, options = {}) {
    if (contextInvalidated) return Promise.resolve({ ok: false, status: 0, body: { error: 'Extension context unavailable.' } })
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          type: 'costa-bridge-fetch',
          path,
          method: options.method || 'GET',
          body: options.body,
        }, (result) => {
          const runtimeError = chrome.runtime.lastError
          if (runtimeError?.message?.includes('Extension context invalidated')) {
            contextInvalidated = true
            clearInterval(intervalId)
          }
          resolve(result || { ok: false, status: 0, body: { error: runtimeError?.message || 'Bridge unavailable.' } })
        })
      } catch (error) {
        if (String(error).includes('Extension context invalidated')) {
          contextInvalidated = true
          clearInterval(intervalId)
        }
        resolve({ ok: false, status: 0, body: { error: String(error) } })
      }
    })
  }

  async function submitPrompt(prompt) {
    const signal = { type: 'prompt_detected', promptId: await promptId(prompt), source: 'chatgpt-dom' }
    console.info('[Costa Clean Bridge] signal', signal)
    window.dispatchEvent(new CustomEvent('costa-prompt-bridge-signal', { detail: signal }))
    const result = await bridgeFetch('/api/prompts', {
      method: 'POST',
      body: { prompt, sourceUrl: conversationUrl },
    })
    if (!result.ok) throw new Error(result.body?.error || 'Bridge rejected prompt.')
    if (result.body?.jobId || result.body?.duplicate) {
      sent.add(prompt)
      sessionStorage.setItem('costaPromptBridgeSent', JSON.stringify([...sent].slice(-20)))
      console.info('[Costa Clean Bridge] prompt accepted', {
        jobId: result.body.jobId || null,
        duplicate: Boolean(result.body.duplicate),
      })
    }
  }

  async function promptId(prompt) {
    const bytes = new TextEncoder().encode(prompt.trim())
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
  }

  async function reconcileSentPrompt(prompt) {
    if (!sent.has(prompt)) return
    const id = await promptId(prompt)
    const response = await bridgeFetch('/api/jobs')
    if (!response.ok) return
    const previous = response.body.find((candidate) => candidate.id === id && candidate.sourceUrl === conversationUrl)
    if (!previous || previous.status === 'failed' || previous.status === 'rejected') {
      sent.delete(prompt)
      sessionStorage.setItem('costaPromptBridgeSent', JSON.stringify([...sent].slice(-20)))
      console.warn('[Costa Clean Bridge] clearing stale sent marker', {
        promptId: id,
        previousStatus: previous?.status || 'missing',
      })
    }
  }

  async function publishCompletedJob() {
    if (busy || pageGone) return
    const response = await bridgeFetch('/api/jobs')
    if (!response.ok) return
    const jobs = response.body
    const job = jobs
      .filter((candidate) => candidate.status === 'complete'
        && candidate.sourceUrl === conversationUrl
        && !sessionStorage.getItem(`costaPromptBridgePublished:v2:${candidate.id}`))
      .sort((left, right) => Date.parse(right.finishedAt || '') - Date.parse(left.finishedAt || ''))[0]
    if (!job) return
    if (!composer()) return
    busy = true
    try {
      const output = job.output || 'Codex terminó sin informe.'
      setComposer(output)
      sent.add(output)
      sessionStorage.setItem('costaPromptBridgeSent', JSON.stringify([...sent].slice(-20)))
      await new Promise((resolve) => setTimeout(resolve, 300))
      const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Enviar" i], button[aria-label*="Send" i]')
      if (sendButton && !sendButton.disabled) {
        sendButton.click()
      } else {
        throw new Error('ChatGPT send button is unavailable; keeping the job unpublished for retry.')
      }
      sessionStorage.setItem(`costaPromptBridgePublished:v2:${job.id}`, '1')
      const signal = { type: 'codex_output_ready', jobId: job.id, source: 'local-bridge' }
      console.info('[Costa Clean Bridge] signal', signal)
      window.dispatchEvent(new CustomEvent('costa-prompt-bridge-signal', { detail: signal }))
    } finally {
      busy = false
    }
  }

  async function approveSensitiveJobs() {
    const response = await bridgeFetch('/api/jobs')
    if (!response.ok) return
    const pending = response.body
      .filter((candidate) => candidate.status === 'awaiting_approval' && candidate.sourceUrl === conversationUrl)
      .sort((left, right) => Date.parse(left.receivedAt || '') - Date.parse(right.receivedAt || ''))
    const job = pending[0]
    if (!job || sessionStorage.getItem(`costaPromptBridgeApproval:${job.id}`)) return
    sessionStorage.setItem(`costaPromptBridgeApproval:${job.id}`, 'shown')
    const approved = window.confirm(`Costa Clean necesita aprobación para continuar.\n\nMotivo: ${job.approvalReason || 'operación sensible'}\n\nAceptar para ejecutar este trabajo.`)
    const action = approved ? 'approve' : 'reject'
    await bridgeFetch(`/api/jobs/${job.id}/${action}`, { method: 'POST' })
  }

  async function tick() {
    if (pageGone || contextInvalidated) return
    try {
      const newest = messages().at(-1)
      if (newest) await reconcileSentPrompt(newest)
      if (newest && isCodexPrompt(newest) && !sent.has(newest) && !newest.startsWith('CP-3B.4 RESULT') && !newest.startsWith(bridgeControlPrefix)) await submitPrompt(newest)
      const newestAssistantPrompt = assistantMessages().at(-1)
      if (newestAssistantPrompt) await reconcileSentPrompt(newestAssistantPrompt)
      if (assistantLastSeen === null) {
        assistantLastSeen = newestAssistantPrompt || ''
        const bootstrapKey = `costaPromptBridgeBootstrapped:${conversationUrl}`
        if (newestAssistantPrompt && (!sessionStorage.getItem(bootstrapKey) || !sent.has(newestAssistantPrompt))) {
          sessionStorage.setItem(bootstrapKey, '1')
          await submitPrompt(newestAssistantPrompt)
        }
      } else if (newestAssistantPrompt && newestAssistantPrompt !== assistantLastSeen && !sent.has(newestAssistantPrompt)) {
        if (newestAssistantPrompt !== assistantCandidate) {
          assistantCandidate = newestAssistantPrompt
          assistantCandidateSince = Date.now()
        } else if (Date.now() - assistantCandidateSince >= 1500) {
          await submitPrompt(newestAssistantPrompt)
          assistantLastSeen = newestAssistantPrompt
          assistantCandidate = ''
          assistantCandidateSince = 0
        }
      } else if (newestAssistantPrompt === assistantLastSeen) {
        assistantCandidate = ''
        assistantCandidateSince = 0
      } else {
        assistantCandidate = ''
        assistantCandidateSince = 0
      }
      await publishCompletedJob()
      await approveSensitiveJobs()
    } catch (error) {
      // ChatGPT's DOM and extension context can change during navigation.
      console.warn('[Costa Clean Bridge] tick failed; retrying', String(error))
    }
  }

  function scheduleTick() {
    if (pageGone || contextInvalidated || tickScheduled) return
    tickScheduled = true
    clearTimeout(tickTimer)
    tickTimer = setTimeout(() => {
      tickScheduled = false
      void tick()
    }, 500)
  }

  const observer = new MutationObserver(scheduleTick)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  window.addEventListener('pagehide', () => {
    pageGone = true
    clearInterval(intervalId)
    clearTimeout(tickTimer)
    observer.disconnect()
  }, { once: true })

  intervalId = setInterval(tick, 2500)
  tick()
})()
