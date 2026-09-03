#!/usr/bin/env node
/* The GAP-FILLING proposals page (2026-09-03). Reads docs/triset/proposals.json
   — each row two existing cards that share ONE attribute and a third thing
   that shares it — and posts a grid: the two cards, then a text tile with the
   proposal. Her ♥ on the text tile is the go to draw it. The card thumbs ride
   the derived-thumb route with NO storage url, so a mark here stays a page
   mark and never touches the deck (the v1 inventory's ✕s were mirrored to
   asset votes and knocked cloud-face out of the deal). --post to post. */
const fs = require('fs'); const path = require('path');
const DOCS = path.join(__dirname, '../docs/triset');
const cards = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DOCS, 'cards.json'))).map(c => [c.key, c]));
const attrs = JSON.parse(fs.readFileSync(path.join(DOCS, 'attributes.json')));
const props = JSON.parse(fs.readFileSync(path.join(DOCS, 'proposals.json'))).proposals;
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'triset-card-inventory';
const SESSION = process.env.FORGE_SESSION || '01JGPeGipufHM7P3XCXPs8cJ';
const STATE = path.join(DOCS, 'proposals-page.json');
const thumb = (u) => BASE + '/api/story/thumb?w=900&url=' + encodeURIComponent(u);
const groups = props.map((p, i) => {
  const [a, b] = p.pair.map(k => { if (!cards[k]) throw new Error('unknown card ' + k); return cards[k]; });
  const tag = attrs.tags[p.tag] ? attrs.tags[p.tag].label : p.tag;
  return { label: `${tag}: ${a.title} + ${b.title} → ${p.new}`, items: [
    { id: `p${i + 1}-a`, img: thumb(a.url), label: a.title },
    { id: `p${i + 1}-b`, img: thumb(b.url), label: b.title },
    { id: `p${i + 1}-new`, text: p.new, label: '♥ to draw it' },
  ] };
});
const title = `Gap fillers v1 — ${props.length} proposed cards`;
console.log(title); props.forEach(p => console.log(' ', p.tag, ':', p.new));
if (!process.argv.includes('--post')) process.exit(0);
(async () => {
  const data = { groups, help: 'Each row: two cards that share one thing and not much else, and a new card that would share it too. ♥ the words to have it drawn; ✕ to drop the idea. The two pictures are just the pair.', start: 'compare', stamp: false, voice: true };
  const r = await fetch(BASE + '/api/chatfeed/page', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat: CHAT, session: SESSION, title, template: 'grid', data }) });
  const j = await r.json(); if (!j.ok) { console.error(j); process.exit(1); }
  console.log('posted', j.id, j.warnings || '');
  let prev = null; try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  if (prev && prev.id) await fetch(`${BASE}/api/chatfeed/page/${prev.id}/supersede`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat: CHAT, session: SESSION, by: j.id }) }).catch(() => {});
  fs.writeFileSync(STATE, JSON.stringify({ id: j.id, title, count: props.length, posted: new Date().toISOString() }, null, 1));
})();
