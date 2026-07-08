// popup.js — load/save the extension settings to chrome.storage.sync.
const fields = ['endpoint', 'token', 'batch', 'keyword'];
const DEFAULTS = { endpoint: 'https://imageforge-q125.onrender.com', batch: 'houseplants' };

chrome.storage.sync.get(fields).then((cfg) => {
  for (const f of fields) {
    document.getElementById(f).value = cfg[f] || DEFAULTS[f] || '';
  }
});

document.getElementById('save').addEventListener('click', async () => {
  const out = {};
  for (const f of fields) out[f] = document.getElementById(f).value.trim();
  await chrome.storage.sync.set(out);
  const el = document.getElementById('saved');
  el.textContent = 'Saved.';
  setTimeout(() => { el.textContent = ''; }, 2000);
});
