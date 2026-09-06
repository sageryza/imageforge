#!/usr/bin/env node
/**
 * marla-chosen.js — which picture is THE picture for each page.
 *
 * Sophie: "are you keeping track of what I choose and don't choose". The honest
 * answer was no. Every script here picked the NEWEST version per page, and that
 * is wrong exactly when she keeps an older one — measured the day she asked:
 * she had hearted p01-f (the painted-over cover), p18-s1 and p31-s4, while
 * newest-wins was serving p01-s2 (the fishbowl with the ball floating in the
 * air), p18-s5 and p31-s5. Her caption-placement examples were built on three
 * pictures she had already passed over.
 *
 * So the record lives here, derived from the votes she really left:
 *   hearted  → that IS the page's picture, whatever its date
 *   rejected → never chosen, even if it is the newest
 *   neither  → the newest un-rejected one, marked `provisional` so nothing
 *              downstream can mistake a guess for her decision
 *
 * Nothing in this file is invented. A page with no heart says so.
 *
 *   node scripts/marla-chosen.js [--print]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHAT = 'marlas-eyes-fishbowl-storybook';
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/marla/state.json'), 'utf8'));
const ROUNDS = ['s1', 'v2', 'v3', 'v3e', 's2', 's2diag', 's4', 's5', 'fishbowlTest'];

// A composed page webp and its raw art are the same picture under two paths;
// her heart lands on whichever tile she was looking at.
const pageNumOf = (url) => {
  const f = String(url).split('/').pop() || '';
  const m = f.match(/^p(\d{1,2})(?:[-.]|$)/);
  return m ? Number(m[1]) : null;
};

function everyVersion() {
  const out = {};
  for (const b of ROUNDS) {
    for (const [k, v] of Object.entries(state[b] || {})) {
      const art = v.artUrl || v.url;
      if (!art) continue;
      const n = pageNumOf(art);
      if (!n) continue;
      (out[n] = out[n] || []).push({ n, round: b, key: k, art, page: v.pageUrl || null, at: v.at || 0 });
    }
  }
  for (const [k, v] of Object.entries(state.pages || {})) {
    const n = Number(k);
    if (!v.artUrl) continue;
    (out[n] = out[n] || []).push({ n, round: 'r1', key: k, art: v.artUrl, page: v.pageUrl || null, at: v.at || 0 });
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.at - b.at);
  return out;
}

const base = (u) => String(u).split('/').pop().replace(/\.(png|webp|jpg)$/i, '');

(async () => {
  const r = await fetch(`${BASE}/api/gallery/assets?chat=${encodeURIComponent(CHAT)}&limit=400`);
  const assets = (await r.json()).assets || [];
  const vote = new Map();                       // base filename -> like | dislike
  for (const a of assets) if (a.vote) vote.set(base(a.url), a.vote);

  const versions = everyVersion();
  const chosen = {};
  for (const [n, list] of Object.entries(versions)) {
    // her heart on EITHER path (the art or its composed page) picks that version
    const liked = list.filter((v) => vote.get(base(v.art)) === 'like' || (v.page && vote.get(base(v.page)) === 'like'));
    const rejected = (v) => vote.get(base(v.art)) === 'dislike' || (v.page && vote.get(base(v.page)) === 'dislike');
    if (liked.length) {
      const pick = liked[liked.length - 1];      // newest thing she actually hearted
      chosen[n] = { ...pick, source: 'hearted', provisional: false };
    } else {
      const live = list.filter((v) => !rejected(v));
      if (!live.length) continue;
      const pick = live[live.length - 1];
      chosen[n] = { ...pick, source: 'newest un-rejected', provisional: true };
    }
  }
  fs.writeFileSync(path.join(ROOT, 'docs/marla/chosen.json'), JSON.stringify(chosen, null, 1) + '\n');

  const hearted = Object.values(chosen).filter((c) => !c.provisional);
  console.log(`${Object.keys(chosen).length} pages · ${hearted.length} you picked · ${Object.keys(chosen).length - hearted.length} still my guess`);
  if (process.argv.includes('--print')) {
    for (const n of Object.keys(chosen).map(Number).sort((a, b) => a - b)) {
      const c = chosen[n];
      console.log(`p${String(n).padStart(2)} ${c.provisional ? '  ' : '♥ '}${c.round}/${c.key}  ${c.art.split('/').pop()}`);
    }
  }
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
