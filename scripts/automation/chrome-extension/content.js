(() => {
  const conversationUrls = [
    'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e',
    'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9988a6-ddac-83eb-9230-300f27403e6b',
  ]
  const conversationUrl = `${location.origin}${location.pathname}`
  const bridgeUrl = 'http://127.0.0.1:4319'
  const sent = new Set(JSON.parse(sessionStorage.getItem('costaPromptBridgeSent') || '[]'))
  let busy = false

  if (!conversationUrls.includes(conversationUrl)) return

  function messages() {
    return [...document.querySelectorAll('[data-message-author-role="user"]')]
      .map((node) => node.innerText.trim())
      .filter(Boolean)
  }

  function composer() {
    return document.querySelector('#prompt-textarea, textarea[placeholder], [contenteditable="true"]')
  }

  function setComposer(value) {
    const target = composer()
    if (!target) throw new Error('ChatGPT composer not found.')
    target.focus()
    if (target.matches('[contenteditable="true"]')) {
      target.textContent = value
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    } else {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(target, value)
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  async function submitPrompt(prompt) {
    const response = await fetch(`${bridgeUrl}/api/prompts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, sourceUrl: conversationUrl }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Bridge rejected prompt.')
    if (result.jobId) {
      sent.add(prompt)
      sessionStorage.setItem('costaPromptBridgeSent', JSON.stringify([...sent].slice(-20)))
    }
  }

  async function publishCompletedJob() {
    if (busy) return
    const response = await fetch(`${bridgeUrl}/api/jobs`)
    if (!response.ok) return
    const jobs = await response.json()
    const job = jobs.find((candidate) => candidate.status === 'complete' && !sessionStorage.getItem(`costaPromptBridgePublished:${candidate.id}`))
    if (!job) return
    busy = true
    try {
      setComposer(job.output || 'Codex terminó sin informe.')
      sessionStorage.setItem(`costaPromptBridgePublished:${job.id}`, '1')
      await new Promise((resolve) => setTimeout(resolve, 300))
      composer()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    } finally {
      busy = false
    }
  }

  async function tick() {
    try {
      const newest = messages().at(-1)
      if (newest && !sent.has(newest) && !newest.startsWith('CP-3B.4 RESULT')) await submitPrompt(newest)
      await publishCompletedJob()
    } catch (error) {
      console.warn('[Costa Prompt Bridge]', error)
    }
  }

  setInterval(tick, 2500)
  tick()
})()
