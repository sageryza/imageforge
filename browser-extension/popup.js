// popup.js — load/save the extension settings to chrome.storage.sync.
const TEXT = ['endpoint', 'token', 'batch', 'keyword'];
const DEFAULTS = { endpoint: 'https://imageforge-q125.onrender.com', batch: 'houseplants' };

chrome.storage.sync.get([...TEXT, 'autoscroll']).then((cfg) => {
  for (const f of TEXT) document.getElementById(f).value = cfg[f] || DEFAULTS[f] || '';
  // auto-scroll defaults ON unless explicitly set to false
  document.getElementById('autoscroll').checked = cfg.autoscroll !== false;
});

document.getElementById('save').addEventListener('click', async () => {
  const out = {};
  for (const f of TEXT) out[f] = document.getElementById(f).value.trim();
  out.autoscroll = document.getElementById('autoscroll').checked;
  await chrome.storage.sync.set(out);
  const el = document.getElementById('saved');
  el.textContent = 'Saved.';
  setTimeout(() => { el.textContent = ''; }, 2000);
});
