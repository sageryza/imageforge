#!/usr/bin/env node
/**
 * post-page.js — the 47 stills as ONE storyboard page in the Compare tab.
 *
 * A grid, one GROUP per reel, panels in script order — so the whole reel reads
 * top to bottom the way it will be cut, which a tile grid sorted by filing time
 * cannot show. Posted as `template:'grid'` DATA, never hand-built HTML: the
 * house rule is that a list fits a stock template, and a posted page is frozen
 * the day it is posted.
 *
 *   node scripts/witch-reels/post-page.js [--manifest /tmp/witch-reel-panels/manifest.json]
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'witchcraft-reels-panels';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

const STILLS = JSON.parse(fs.readFileSync(path.join(HERE, 'stills.json'), 'utf8'));

// Source of truth is the chat's own Assets tab, not a local manifest — the
// run happened in two passes (a fixed cut mid-batch) and only the tab holds
// every panel from both. A url is `witch-reels/<still id>-<madeAt>.webp`, so
// the newest stamp per id is the live cut and the earlier one is superseded.
async function panelsFromAssets() {
  const out = {};
  for (let offset = 0; ; offset += 150) {
    const res = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(CHAT)}&limit=150&offset=${offset}`);
    const d = await res.json();
    const assets = d.assets || [];
    for (const a of assets) {
      const m = /witch-reels\/(.+)-(\d{13})\.webp/.exec(a.url || '');
      if (!m || m[1].startsWith('sheet-')) continue;
      const [, id, ts] = m;
      if (!out[id] || Number(ts) > out[id].madeAt) out[id] = { id, url: a.url, madeAt: Number(ts) };
    }
    if (assets.length < 150 || offset + 150 >= (d.total || 0)) break;
  }
  return out;
}

(async () => {
const byId = await panelsFromAssets();
const order = [];
for (const s of STILLS) {
  if (!order.length || order[order.length - 1].reel !== s.reel) {
    order.push({ reel: s.reel, label: s.reelTitle, items: [] });
  }
  const p = byId[s.id];
  if (!p) { console.warn(`missing panel: ${s.id}`); continue; }
  order[order.length - 1].items.push({
    id: s.id,
    label: `${s.id.split('-').pop()} · ${s.label}`,
    img: p.url,
    url: p.url,
    model: 'gpt-image-2',
    quality: 'low',
    promptContent: s.content,
  });
}

  const groups = order.map(g => ({ label: g.label, items: g.items }));
  const res = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat: CHAT,
      title: flag('title', 'Witchcraft reels — the 47 stills v1'),
      template: 'grid',
      data: { groups, aspect: 'portrait' },
    }),
  });
  const d = await res.json();
  console.log(`${groups.length} groups · ${groups.reduce((n, g) => n + g.items.length, 0)} panels`);
  console.log(JSON.stringify(d, null, 2));
})();
