const exact = 'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e';
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.type !== 'new-message' || sender.tab?.url?.split(/[?#]/)[0].replace(/\/$/, '') !== exact) return;
  chrome.storage.local.get({ port: 4179, token: '', autoPaste: false }, settings => {
    fetch(`http://127.0.0.1:${settings.port}/events`, { method: 'POST', headers: { 'content-type': 'application/json', ...(settings.token ? { authorization: `Bearer ${settings.token}` } : {}) }, body: JSON.stringify(request.message) }).then(response => response.json()).then(result => {
      if (!settings.autoPaste || !result.accepted) return;
      chrome.tabs.sendMessage(sender.tab.id, { type: 'draft', text: `Orquestador local\nRun: ${result.runId}\nEstado: ${result.status}\nNo enviado automáticamente.` });
    }).catch(() => undefined);
  });
});
