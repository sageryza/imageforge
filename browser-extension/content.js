// content.js — injects the "Send to Deck Factory" button onto midjourney.com.
// On click it collects the Midjourney image URLs and hands them to the background
// worker, which POSTs them to the Deck Factory import pipeline in chunks.
//
// Two collect modes (popup setting "autoscroll", default ON):
//   • auto-scroll: scrolls the whole search/likes, accumulating every image as it
//     goes — robust even if Midjourney unloads off-screen images, because URLs are
//     captured before they can drop out of the DOM.
//   • current page: just what's loaded right now.
//
// CALIBRATION: Midjourney's DOM/CDN format isn't public and changes over time, so
// collectOnPage / toFullRes / pickScroller are the pieces that may need a tune-up
// on the first real run. They log to the console so it's easy to adjust.

(function () {
  if (window.__deckFactoryInjected) return;
  window.__deckFactoryInjected = true;

  const DEFAULT_ENDPOINT = 'https://imageforge-q125.onrender.com';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── image gathering (calibration surface) ─────────────────────────
  function toFullRes(url) {
    try {
      let u = url.split('?')[0];
      u = u.replace(/_(\d{2,4})_N(\.\w+)$/i, '$2'); // drop MJ thumbnail size token
      u = u.replace(/\.webp$/i, '.png');
      return u;
    } catch { return url; }
  }

  function collectOnPage() {
    const out = new Set();
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src || '';
      if (!/cdn\.midjourney\.com/i.test(src)) continue;
      const w = img.naturalWidth || img.width || 0;
      if (w && w < 200) continue; // skip avatars / UI icons
      out.add(toFullRes(src));
    }
    return [...out];
  }

  // Find the element that actually scrolls (window, or an inner container).
  function pickScroller() {
    let best = document.scrollingElement || document.documentElement;
    let bestScore = (best.scrollHeight || 0) - (best.clientHeight || 0);
    for (const el of document.querySelectorAll('div,main,section')) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        const score = el.scrollHeight - el.clientHeight;
        if (score > bestScore) { best = el; bestScore = score; }
      }
    }
    return best;
  }

  function scrollStep(el) {
    el.scrollTop = Math.min(el.scrollTop + el.clientHeight * 0.9, el.scrollHeight);
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 4; // at bottom?
  }

  // Scroll the whole view, accumulating every image. Stops when it reaches the
  // bottom and no new images appear for a few rounds (or the user cancels).
  async function autoScrollCollect(onProgress, isCancelled) {
    const found = new Set();
    const scroller = pickScroller();
    let noGrowth = 0;
    for (let i = 0; i < 4000; i++) {
      if (isCancelled()) break;
      const before = found.size;
      for (const u of collectOnPage()) found.add(u);
      onProgress(found.size);
      const atBottom = scrollStep(scroller);
      await sleep(700); // let lazy images load in
      for (const u of collectOnPage()) found.add(u);
      onProgress(found.size);
      if (found.size === before) noGrowth++; else noGrowth = 0;
      if (atBottom && noGrowth >= 3) break;
    }
    console.log('[Deck Factory] collected', found.size, 'image(s)');
    return [...found];
  }

  // ── UI ────────────────────────────────────────────────────────────
  function toast(msg, ok) {
    let t = document.getElementById('df-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'df-toast';
      t.style.cssText = 'position:fixed;bottom:76px;right:20px;z-index:2147483647;max-width:300px;'
        + 'padding:10px 14px;border-radius:6px;font:14px/1.4 -apple-system,BlinkMacSystemFont,'
        + '"Segoe UI",Roboto,sans-serif;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);';
      document.body.appendChild(t);
    }
    t.style.background = ok === false ? '#b03636' : '#2f7d4f';
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t.__hide);
    t.__hide = setTimeout(() => { t.style.opacity = '0'; }, 6000);
  }

  const btn = document.createElement('button');
  btn.id = 'df-send-btn';
  const LABEL = '🌿 Send to Deck Factory';
  btn.textContent = LABEL;
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;border:none;'
    + 'border-radius:6px;background:#c98b3a;color:#fff;font:600 14px -apple-system,BlinkMacSystemFont,'
    + '"Segoe UI",Roboto,sans-serif;padding:12px 16px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);';

  let running = false;

  async function uploadInChunks(urls, cfg, onProgress) {
    const CHUNK = 20;
    let sent = 0;
    for (let i = 0; i < urls.length; i += CHUNK) {
      if (!running) break;
      const chunk = urls.slice(i, i + CHUNK);
      const res = await chrome.runtime.sendMessage({
        type: 'upload', urls: chunk,
        endpoint: cfg.endpoint, token: cfg.token, batch: cfg.batch, keyword: cfg.keyword,
      });
      if (!res || !res.ok) throw new Error((res && res.error) || 'upload failed');
      sent += res.count || chunk.length;
      onProgress(sent, urls.length);
    }
    return sent;
  }

  btn.addEventListener('click', async () => {
    if (running) { running = false; btn.textContent = 'Stopping…'; return; } // click again = stop
    const cfg = await chrome.storage.sync.get(['endpoint', 'token', 'batch', 'keyword', 'autoscroll']);
    if (!cfg.token) { toast('Set your studio token in the extension popup first.', false); return; }
    running = true;
    try {
      let urls;
      if (cfg.autoscroll === false) {
        urls = collectOnPage();
      } else {
        btn.textContent = 'Scrolling… (click to stop)';
        urls = await autoScrollCollect(
          (n) => { if (running) btn.textContent = `Collecting ${n}… (click to stop)`; },
          () => !running,
        );
      }
      if (!urls.length) { toast('No Midjourney images found on this page.', false); return; }
      running = true; // ensure upload proceeds even if scroll ended
      const send = {
        endpoint: (cfg.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, ''),
        token: cfg.token, batch: cfg.batch || 'midjourney', keyword: cfg.keyword || '',
      };
      btn.textContent = `Uploading ${urls.length}…`;
      const sent = await uploadInChunks(urls, send, (s, t) => { btn.textContent = `Uploading ${s}/${t}…`; });
      toast(`Sent ${sent} image(s) to batch "${send.batch}". Tell Claude the batch name.`, true);
    } catch (e) {
      toast('Error: ' + e.message, false);
    } finally {
      running = false;
      btn.textContent = LABEL;
    }
  });

  document.body.appendChild(btn);
})();
