const exact = 'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e';
let lastFingerprint = '';
function newestMessage() {
  if (location.href.split(/[?#]/)[0].replace(/\/$/, '') !== exact) return null;
  const nodes = [...document.querySelectorAll('[data-message-author-role], article, main [role="article"]')].filter(node => node.innerText?.trim());
  const node = nodes.at(-1); if (!node) return null;
  const text = node.innerText.trim(); const messageId = node.getAttribute('data-message-id') || node.id || crypto.randomUUID();
  return { conversationUrl: exact, messageId, text };
}
function observe() { const message = newestMessage(); if (!message) return; const fingerprint = `${message.messageId}:${message.text}`; if (fingerprint === lastFingerprint) return; lastFingerprint = fingerprint; chrome.runtime.sendMessage({ type: 'new-message', message }); }
new MutationObserver(observe).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
setTimeout(observe, 1200);
chrome.runtime.onMessage.addListener(request => {
  if (request.type !== 'draft') return;
  const composer = document.querySelector('textarea, [contenteditable="true"]');
  if (!composer) return;
  if (composer.matches('textarea')) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(composer, request.text); composer.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    composer.textContent = request.text; composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: request.text }));
  }
});
