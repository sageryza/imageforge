// background.js — service worker. Receives image URLs from the content script and
// POSTs them to the Deck Factory import pipeline (/api/ingest/upload). Running the
// POST here (with host_permissions for the app) avoids cross-origin/CORS issues.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'upload') {
    handleUpload(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // keep the message channel open for the async response
  }
  return false;
});

async function handleUpload({ urls, endpoint, token, batch, keyword }) {
  const base = (endpoint || 'https://imageforge-q125.onrender.com').replace(/\/+$/, '');
  const res = await fetch(base + '/api/ingest/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-studio-token': token },
    body: JSON.stringify({ batch, keyword: keyword || undefined, images: urls }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) return { ok: false, error: data.error || ('HTTP ' + res.status) };
  return { ok: true, count: data.count, batch: data.batch, images: data.images };
}
