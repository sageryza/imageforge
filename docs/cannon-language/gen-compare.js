#!/usr/bin/env node
// Upload the finished film to Storage and post the Compare page for it.
//
// A new version is a NEW page pointing at NEW version-numbered media — never
// an edit of an older one — so `--version` is required and rides in the title,
// the storage path and the verdict sheet.
//
//   node gen-compare.js --film /path/film-v1.mp4 --version v1
const fs = require('fs');
const path = require('path');
const admin = require('/home/user/imageforge/node_modules/firebase-admin');

const DIR = __dirname;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'illustrated-cannon-passage';
const TOKEN = process.env.STUDIO_TOKEN || '';
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILM = argOf('--film', '');
const VERSION = argOf('--version', 'v1');
const QUALITY = argOf('--quality', 'medium');

const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'shots.json'), 'utf8'));
const stills = JSON.parse(fs.readFileSync(path.join(DIR, `renders-${QUALITY}.json`), 'utf8'));
const narr = JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(DIR, 'lines.local.json'), 'utf8'));
const LABELS = JSON.parse(fs.readFileSync(path.join(DIR, 'labels.json'), 'utf8'));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ACTS = {
  '1': ['Act one — the groping', 'Voices across four books failing to say a thing. A 1600s druid opens it, so the failure is not only an alien one.'],
  '2': ['Act two — naming it', 'Dolores says what the problem actually is.'],
  '3': ['Act three — the answer', 'One continuous passage in Custodians 2. Their unit of meaning is a whole field; ours is one small word.'],
  '4': ['Act four — it turns on us', 'You already do this. You just call it Christmas.'],
  'close': ['Close', ''],
};

(async () => {
  if (!FILM || !fs.existsSync(FILM)) throw new Error(`--film not found: ${FILM}`);

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: `${sa.project_id}.firebasestorage.app` });
  }
  const bucket = admin.storage().bucket();
  const dest = `cannon-language/no-words-for-it-${VERSION}.mp4`;
  await bucket.upload(FILM, { destination: dest, metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable' } });
  await bucket.file(dest).makePublic();
  const filmUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
  console.log(`film → ${filmUrl}`);

  const totalSecs = Object.values(narr).reduce((a, n) => a + n.seconds, 0);

  let body = '';
  let lastAct = null;
  for (const s of spec.shots) {
    if (s.act !== lastAct) {
      if (lastAct !== null) body += `    </div>\n  </div>\n`;
      const [h, sub] = ACTS[s.act] || [s.act, ''];
      body += `\n  <div class="card">\n    <h2>${esc(h)}</h2>\n`;
      if (sub) body += `    <p>${esc(sub)}</p>\n`;
      body += `    <div class="imgrow">\n`;
      lastAct = s.act;
    }
    const st = stills[s.n];
    const n = narr[s.n];
    body += `      <figure data-item="shot-${s.n}">\n`;
    body += `        <img src="${esc(st.url)}" alt="${esc(LABELS[s.n] || '')}">\n`;
    body += `        <figcaption><b>${s.n}.</b> &ldquo;${esc(LINES[s.n] || '')}&rdquo;<br>`;
    body += `<small>${esc(s.cite)} · ${n ? n.seconds.toFixed(2) : '?'}s</small></figcaption>\n`;
    body += `      </figure>\n`;
  }
  body += `    </div>\n  </div>\n`;

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>No Words For It ${esc(VERSION)}</title>
<link rel="stylesheet" href="/compare.css">
<style>
  figure { margin: 0; }
  figure img { width: 100%; display: block; }
  figcaption { font-size: 13px; line-height: 1.45; margin-top: 6px; color: var(--ink); }
  figcaption small { color: var(--ink2); }
  video { width: 100%; display: block; border: 1px solid var(--line, #d8cfbc); }
</style>

<div class="wrap">
  <div class="eyebrow">ILLUSTRATED CANNON PASSAGE · LANGUAGE</div>
  <h1>No Words For It — ${esc(VERSION)}</h1>
  <div class="sub">Twenty shots, ${totalSecs.toFixed(0)} seconds, narrated in the audiobooks&rsquo; own voice. The running &ldquo;I can&rsquo;t explain this&rdquo; thread, answered by the one passage that says why.</div>

  <div class="card" data-item="film">
    <h2>The film</h2>
    <video src="${esc(filmUrl)}" controls playsinline preload="metadata"></video>
  </div>
${body}</div>

<script src="/compare.js"></script>
<script>
(function () {
  window.__compareNotes({ chat: ${JSON.stringify(CHAT)}, sheet: ${JSON.stringify('no-words-' + VERSION)} });
})();
</script>
`;

  const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { 'x-studio-token': TOKEN } : {}) };
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers,
    body: JSON.stringify({ chat: CHAT, title: `No Words For It ${VERSION} — 20 shots, ${totalSecs.toFixed(0)}s`, html }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(r.ok ? `compare page posted: ${JSON.stringify(j).slice(0, 200)}` : `FAILED ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  fs.writeFileSync(path.join(DIR, `film-${VERSION}.json`), JSON.stringify({ version: VERSION, filmUrl, page: j, at: new Date().toISOString() }, null, 2));
})();
