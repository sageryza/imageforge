// content.js — injects the "Send to Deck Factory" button onto midjourney.com and,
// on click, gathers the Midjourney image URLs on the page and hands them to the
// background worker, which POSTs them to the Deck Factory import pipeline.
//
// CALIBRATION NOTE: Midjourney's page DOM isn't public and changes over time, so
// the image-gathering below (collectMidjourneyImageUrls / toFullRes) is the one
// piece likely to need a tune-up on the first real run. It's isolated here and
// logs what it found to the console so it's easy to adjust.

(function () {
  if (window.__deckFactoryInjected) return;
  window.__deckFactoryInjected = true;

  // ── gather Midjourney image URLs on the page ──────────────────────
  // Grabs <img> elements served from Midjourney's CDN, skips tiny ones
  // (avatars/icons), de-dupes, and upgrades thumbnail URLs to full-res.
  function toFullRes(url) {
    // MJ thumbnails look like  .../<id>/0_0_384_N.webp  ; full-res is
    // .../<id>/0_0.png  — strip the "_<size>_N" token and prefer .png.
    try {
      let u = url.split('?')[0];
      u = u.replace(/_(\d{2,4})_N(\.\w+)$/i, '$2'); // drop size token
      u = u.replace(/\.webp$/i, '.png');
      return u;
    } catch { return url; }
  }

  function collectMidjourneyImageUrls() {
    const imgs = Array.from(document.querySelectorAll('img'));
    const urls = new Set();
    for (const img of imgs) {
      const src = img.currentSrc || img.src || '';
      if (!/cdn\.midjourney\.com/i.test(src)) continue;
      // skip obvious non-art (small avatars / UI icons)
      const w = img.naturalWidth || img.width || 0;
      if (w && w < 200) continue;
      urls.add(toFullRes(src));
    }
    const list = [...urls];
    console.log('[Deck Factory] found', list.length, 'Midjourney image(s):', list);
    return list;
  }

  // ── tiny UI: floating button + toast ──────────────────────────────
  function toast(msg, ok) {
    let t = document.getElementById('df-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'df-toast';
      t.style.cssText = 'position:fixed;bottom:76px;right:20px;z-index:2147483647;'
        + 'max-width:280px;padding:10px 14px;border-radius:6px;font:14px/1.4 -apple-system,'
        + 'BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);';
      document.body.appendChild(t);
    }
    t.style.background = ok === false ? '#b03636' : '#2f7d4f';
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t.__hide);
    t.__hide = setTimeout(() => { t.style.opacity = '0'; }, 5000);
  }

  const btn = document.createElement('button');
  btn.id = 'df-send-btn';
  btn.textContent = '🌿 Send to Deck Factory';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;'
    + 'border:none;border-radius:6px;background:#c98b3a;color:#fff;font:600 14px -apple-system,'
    + 'BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:12px 16px;cursor:pointer;'
    + 'box-shadow:0 4px 14px rgba(0,0,0,.3);';

  btn.addEventListener('click', async () => {
    const cfg = await chrome.storage.sync.get(
      ['endpoint', 'token', 'batch', 'keyword']);
    if (!cfg.token) {
      toast('Set your studio token in the extension popup first.', false);
      return;
    }
    const urls = collectMidjourneyImageUrls();
    if (!urls.length) {
      toast('No Midjourney images found on this page. Scroll the ones you want into view.', false);
      return;
    }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = `Sending ${urls.length}…`;
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'upload', urls,
        endpoint: cfg.endpoint || 'https://imageforge-q125.onrender.com',
        token: cfg.token,
        batch: cfg.batch || 'midjourney',
        keyword: cfg.keyword || '',
      });
      if (res && res.ok) {
        toast(`Sent ${res.count} image(s) to batch "${res.batch}". Tell Claude the batch name.`, true);
      } else {
        toast('Upload failed: ' + ((res && res.error) || 'unknown error'), false);
      }
    } catch (e) {
      toast('Upload error: ' + e.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  document.body.appendChild(btn);
})();
