#!/usr/bin/env node
/* The Similitude / Triset VISUAL INVENTORY sheet (2026-09-02, Sophie: "take an
   inventory, and start tagging them by their attributes … gathering together
   a visual inventory of the types, grouping them by what they have in common
   … create a compare sheet showing all the cards chosen, not just nature.
   include triangles i hearted in playground").

   docs/triset/cards.json is the chosen set — the 84 cards in the deal (her
   nature deck plus the ten she adopted from the waiting room, plus the four
   made in the game) and the triangles she hearted in the Playground (the hike
   one left out: an accident, and it has people). docs/triset/attributes.json
   is the tagging — VISUAL attributes, each a thing you can see on the card.

   Two cards CONNECT when they share a tag. This script counts that per card,
   builds one grid page — the culls first (cards with people, two versions of
   one subject, the fewest-connected, the most-connected), then every
   attribute as its own row, biggest first — and, with --post, posts it into
   this chat's Compare tab (template:'grid', so a tap opens the Assets
   lightbox and her ♥/✕ sync). Every tile's line is the card and how many
   cards it connects to. Nothing here draws or spends anything.

   --post   post the page (supersedes the last one this script posted, read
            back from docs/triset/inventory-page.json). */
const fs = require('fs');
const path = require('path');
const DOCS = path.join(__dirname, '../docs/triset');
const cards = JSON.parse(fs.readFileSync(path.join(DOCS, 'cards.json'), 'utf8'));
const attrs = JSON.parse(fs.readFileSync(path.join(DOCS, 'attributes.json'), 'utf8'));
const BASE = process.env.FORGE_BASE || 'https://imageforge-q125.onrender.com';
const CHAT = process.env.FORGE_CHAT || 'triset-card-inventory';
const SESSION = process.env.FORGE_SESSION || '01JGPeGipufHM7P3XCXPs8cJ';
const STATE = path.join(DOCS, 'inventory-page.json');

const byKey = Object.fromEntries(cards.map(c => [c.key, c]));
const tagsOf = {};
for (const [t, v] of Object.entries(attrs.tags)) {
  for (const k of v.cards) {
    if (!byKey[k]) throw new Error(`attributes.json names an unknown card: ${t}:${k}`);
    (tagsOf[k] = tagsOf[k] || []).push(t);
  }
}
const connections = {};
for (const c of cards) {
  const s = new Set();
  for (const t of (tagsOf[c.key] || [])) for (const k of attrs.tags[t].cards) if (k !== c.key) s.add(k);
  connections[c.key] = s.size;
}
const item = (c, group) => ({
  id: `${group}--${c.key}`, img: c.url, url: c.url,
  label: `${c.title} · ${connections[c.key]}`,
  model: 'gpt-image-2', quality: c.quality || '',
});
const ranked = cards.slice().sort((a, b) => connections[a.key] - connections[b.key]);
const groups = [];
groups.push({ label: `Has people — her rule is none do (${attrs.people.cards.length})`,
  items: attrs.people.cards.map(k => item(byKey[k], 'people')) });
groups.push({ label: 'Two versions of one subject — pick one',
  items: attrs.duplicates.pairs.flat().map(k => item(byKey[k], 'dup')) });
groups.push({ label: 'Fewest connections', items: ranked.slice(0, 6).map(c => item(c, 'few')) });
groups.push({ label: 'Most connections', items: ranked.slice(-6).reverse().map(c => item(c, 'most')) });
const tagRows = Object.entries(attrs.tags).sort((a, b) => b[1].cards.length - a[1].cards.length);
for (const [t, v] of tagRows) {
  groups.push({ label: `${v.label} (${v.cards.length})`, items: v.cards.map(k => item(byKey[k], t)) });
}
const total = groups.reduce((n, g) => n + g.items.length, 0);
const title = `Similitude — visual inventory v1 (${cards.length} cards · ${tagRows.length} attributes)`;
const help = 'Every card in the deal plus the triangles you hearted in the Playground, grouped by what you can SEE '
  + 'on them. A card appears under every attribute it carries; the number after its name is how many other '
  + 'cards it connects to. The first four rows are the culls to decide: people, duplicates, the loneliest and the '
  + 'busiest. Tap a picture for the lightbox — an ✕ there takes a card out of the deck.';
const data = { groups, help, start: 'compare', stamp: false, voice: true };
console.log(`cards ${cards.length} · tags ${tagRows.length} · placements ${total} (max 500)`);
console.log('fewest:', ranked.slice(0, 8).map(c => `${c.key} ${connections[c.key]}`).join(' · '));
console.log('most:', ranked.slice(-8).reverse().map(c => `${c.key} ${connections[c.key]}`).join(' · '));
fs.writeFileSync(path.join(DOCS, 'connections.json'), JSON.stringify(
  Object.fromEntries(ranked.map(c => [c.key, { connections: connections[c.key], tags: tagsOf[c.key] || [] }])), null, 1));
if (total > 500) { console.error('over the 500-item cap — trim a tag'); process.exit(1); }
if (!process.argv.includes('--post')) process.exit(0);

(async () => {
  const r = await fetch(BASE + '/api/chatfeed/page', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, session: SESSION, title, template: 'grid', data }),
  });
  const j = await r.json();
  if (!j.ok) { console.error('post failed', j); process.exit(1); }
  console.log('posted', j.id, j.url || '', j.warnings || '');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { /* first post */ }
  if (prev && prev.id && prev.id !== j.id) {
    await fetch(`${BASE}/api/chatfeed/page/${prev.id}/supersede`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, session: SESSION, by: j.id }),
    }).then(x => x.json()).then(x => console.log('superseded', prev.id, x.ok)).catch(() => {});
  }
  fs.writeFileSync(STATE, JSON.stringify({ id: j.id, title, posted: new Date().toISOString(), cards: cards.length, tags: tagRows.length }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
