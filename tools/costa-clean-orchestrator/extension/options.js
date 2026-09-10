const ids = ['port', 'token', 'autoPaste'];
chrome.storage.local.get({ port: 4179, token: '', autoPaste: false }, values => ids.forEach(id => { document.getElementById(id).value = values[id]; document.getElementById(id).checked = values[id]; }));
document.getElementById('save').onclick = () => chrome.storage.local.set({ port: Number(document.getElementById('port').value) || 4179, token: document.getElementById('token').value, autoPaste: document.getElementById('autoPaste').checked });
