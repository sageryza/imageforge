#!/usr/bin/env node
// animal-hearts.js — the animal deck cut down to the cards she HEARTED on the
// swipe deck (2026-09-22, Sophie, swiping the 54: "new deck from just hearts
// no exes"). Reads scripts/decks/animals-drawn.json, her marks off the swipe
// page's verdict doc (item id `swipe--<id>`) and the chat's Assets tab (the
// lightbox's ♥ lands there), keeps only the hearted ones, and writes
// scripts/decks/animals-hearts.json in the same record shape — which
// fruit-flashcards.js --cards then lays out. An ✕ and an unmarked card are
// both left out; the names are printed so nothing drops silently.
//
//   node scripts/animal-hearts.js --swipe <pageId>[,<pageId>…] [--chat animal-deck-heart-tiebreak] [--dry]
//        [--post-unmarked]   post a NEW swipe deck of the cards she has not marked yet
//
// --swipe takes several page ids: every swipe deck posted so far, oldest
// first, since her marks stay on the page she made them on.
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const CHAT = flag('chat', 'animal-deck-heart-tiebreak');
const SWIPE = flag('swipe');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const DRY = args.includes('--dry');
if (!SWIPE) { console.error('--swipe <pageId> is required'); process.exit(1); }
const IN = path.join(__dirname, 'decks', 'animals-drawn.json');
const OUT = path.join(__dirname, 'decks', 'animals-hearts.json');

(async () => {
  const marks = {};
  for (const id of SWIPE.split(',').filter(Boolean)) Object.assign(marks, (await (await fetch(`${BASE}/api/chatfeed/verdict?chat=${CHAT}&sheet=page-${id}`)).json()).items || {});
  const tab = new Map();
  for (const x of (await (await fetch(`${BASE}/api/gallery/assets?chat=${CHAT}&limit=1000`)).json()).assets || []) if (x.vote && x.url) tab.set(x.url.split('/').pop(), x.vote);
  const recs = JSON.parse(fs.readFileSync(IN, 'utf8')).sort((a, b) => a.name.localeCompare(b.name));
  const hearts = [], xs = [], none = [];
  for (const r of recs) {
    const m = marks[`swipe--${r.id}`];
    // A PLAYGROUND HEART IS A HEART TOO (2026-09-22, "add the new hearts" —
    // she hearted the new animals in the Playground, not on a swipe): a card
    // whose pick was settled by a heart anywhere (`by` on the record) is in,
    // unless a swipe or tab ✕ says otherwise. Only "only one drawn" needs her
    // swipe to get in.
    const tv = tab.get(String(r.full).split('/').pop()) || null;
    const mk = m === true ? 'like' : m === false ? 'dislike' : tv === 'dislike' ? 'dislike' : (tv === 'like' || r.by !== 'only one') ? 'like' : null;
    (mk === 'like' ? hearts : mk === 'dislike' ? xs : none).push(r);
  }
  console.log(`${recs.length} on the deck · ${hearts.length} hearted · ${xs.length} ✕'d (${xs.map((r) => r.name).join(', ') || '—'}) · ${none.length} unmarked (${none.map((r) => r.name).join(', ') || '—'})`);
  if (DRY) return;
  fs.writeFileSync(OUT, JSON.stringify(hearts.map((r) => ({ ...r, by: 'swipe ♥' })), null, 1));
  console.log(`wrote ${OUT}`);
  if (args.includes('--post-unmarked') && none.length) {
    const items = none.map((r) => ({ id: `swipe--${r.id}`, img: r.url, full: r.full, url: r.full, label: r.name, model: 'gpt-image-2', quality: r.quality, size: r.size }));
    const posted = await (await fetch(`${BASE}/api/chatfeed/page`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat: CHAT, title: `Animal deck — swipe the ${none.length} not marked yet`, template: 'deck', data: { items, start: 'swipe', help: 'The animals on the deck you have not hearted or crossed yet. A heart puts one on the hearts-only deck.' } }) })).json();
    console.log('unmarked swipe page', JSON.stringify(posted));
  }
})().catch((e) => { console.error(e); process.exit(1); });
