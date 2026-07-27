#!/usr/bin/env node
/**
 * Host every style-test render on Firebase (via /api/ingest/upload) and file
 * it into this chat's Assets tab (via /api/gallery assetsOnly) so Sophie can
 * review them with the heart/reject + notes loop.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://imageforge-q125.onrender.com';
const CHAT = 'hand-drawn-illustration-style';
const SP = __dirname;

const ITEMS = [
  // batch 1 — style v1, sentimental-memory moments (wrong register, kept as evidence)
  ['out/latte-heart--low.png',              'v1 style · Heart in the latte foam · low — went glossy/gradient, off-brief'],
  ['out/grandmother-handwriting--low.png',  "v1 style · Grandmother's handwriting on the photo back · low"],
  ['out/hummingbird-hold--low.png',         'v1 style · Hummingbird stayed the whole phone call · low'],
  ['out/hummingbird-hold--medium.png',      'v1 style · Hummingbird stayed the whole phone call · MEDIUM — medium added clutter here'],
  // batch 2 — style v1, real synchronicity moments
  ['out2/purple-flower--low.png',           'v1 style · Two girls holding hands, the flower was purple · low'],
  ['out2/same-yellow-coat--low.png',        'v1 style · Two strangers in the same yellow coat · low'],
  ['out2/three-birds--low.png',             'v1 style · Three birds, one to each wire · low — cleanest of the v1 set'],
  ['out2/purple-flower--medium.png',        'v1 style · Two girls holding hands, the flower was purple · MEDIUM'],
  // batch 3 — style v2 (content-stripped), same three moments
  ['out3/purple-flower--low.png',           'v2 style · Two girls holding hands, the flower was purple · low'],
  ['out3/same-yellow-coat--low.png',        'v2 style · Two strangers in the same yellow coat · low'],
  ['out3/three-birds--low.png',             'v2 style · Three birds, one to each wire · low — v2 fills the sky with colour'],
  ['out3/purple-flower--medium.png',        'v2 style · Two girls holding hands, the flower was purple · MEDIUM — best of the whole set'],
];

async function post(url, body, extra = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

(async () => {
  const filed = [];
  for (const [rel, description] of ITEMS) {
    const file = path.join(SP, rel);
    if (!fs.existsSync(file)) { console.log('MISSING', rel); continue; }
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');

    // 1. host it
    const up = await post(`${BASE}/api/ingest/upload`, {
      batch: 'style-tests', keyword: path.basename(rel, '.png'), images: [dataUrl],
    });
    const hosted = up.json && up.json.images && up.json.images[0];
    if (!hosted) { console.log('UPLOAD FAIL', rel, up.status, JSON.stringify(up.json).slice(0, 200)); continue; }

    // 2. file it to the chat's Assets tab only
    const g = await post(`${BASE}/api/gallery`, {
      url: hosted, chat: CHAT, assetsOnly: true, description,
    });
    console.log(g.status === 200 ? 'filed' : 'FILE FAIL', rel, g.status, JSON.stringify(g.json).slice(0, 160));
    filed.push({ rel, description, url: hosted });
  }
  fs.writeFileSync(path.join(SP, 'filed-assets.json'), JSON.stringify(filed, null, 2));
  console.log(`\n${filed.length}/${ITEMS.length} filed to Assets (chat: ${CHAT})`);
})();
