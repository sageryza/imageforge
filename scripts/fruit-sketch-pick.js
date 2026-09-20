// fruit-sketch-pick.js — one row per fruit, every version of it side by side,
// so Sophie can heart ONE of each (2026-09-20, Sophie, after sending six 2x2
// sheets of fruit sketches: "cut these up and match so i can pick just one of
// each type").
//
//   node scripts/fruit-sketch-pick.js [--chat fruits-vegetables-inventory] [--dry]
//                                     [--supersede <pageId>]
//
// The sheets were cut with fruit-cut.js (--cols 2 --rows 2) and uploaded to
// fruit/full + fruit/card as `<deckId>-sk<N>` (N = which sheet); the records
// are scripts/fruit-chart/sketch-uploaded.json. The existing versions come off
// the other *-uploaded.json files in that folder — the nine-grid v1 cuts
// (grid-2-uploaded.json, ~290px, superseded) are left out on purpose.
//
// A GRID template page (the stock one, never hand-rolled): a group per fruit,
// the card on the deck now first, then any earlier version, then the new
// sketches. ♥ on a tile is her pick; the server keys the verdicts by the page id (`page-<id>`).

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CHAT = flag('chat', 'fruits-vegetables-inventory');
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const SUPERSEDE = flag('supersede');
const SHEET = 'pick-one-v1';
const DRY = args.includes('--dry');

const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'fruit-chart', f), 'utf8'));
const sketches = read('sketch-uploaded.json');
const poll = read('poll-fridge-fruit.json'); // GET /api/fruit/poll/fridge-fruit, saved 2026-09-20
const deckUrl = new Map(poll.fruits.map(f => [f.id, f.url]));

// Every existing card per deck id, keyed by card url so twins collapse.
const existing = new Map();
const add = (id, rec, quality) => {
  if (!existing.has(id)) existing.set(id, new Map());
  existing.get(id).set(rec.url, { ...rec, quality });
};
for (const f of read('uploaded.json')) add(f.id, f, 'medium');
for (const f of read('v2-uploaded.json')) add(f.id, f, 'medium');
for (const f of read('v3-uploaded.json')) add(f.id, f, 'medium');
for (const file of ['hq-uploaded.json', 'hq2-uploaded.json', 'hq3-uploaded.json']) {
  for (const f of read(file)) add(f.id, f, 'high');
}

const types = [...new Set(sketches.map(s => s.deck))].sort();
const groups = types.map(id => {
  const name = sketches.find(s => s.deck === id).name;
  const olds = [...(existing.get(id) || new Map()).values()];
  const now = olds.filter(o => o.url === deckUrl.get(id));
  const prior = olds.filter(o => o.url !== deckUrl.get(id));
  const items = [
    ...now.map(o => ({ id: `${id}--deck`, img: o.url, full: o.full, url: o.full,
      label: `on the deck now · ${o.quality}`, model: 'gpt-image-2', quality: o.quality })),
    ...prior.map((o, i) => ({ id: `${id}--prior${i + 1}`, img: o.url, full: o.full, url: o.full,
      label: `earlier version · ${o.quality}`, model: 'gpt-image-2', quality: o.quality })),
    ...sketches.filter(s => s.deck === id).map(s => ({ id: s.id, img: s.url, full: s.full, url: s.full,
      label: `new · sheet ${s.sheet}` })),
  ];
  return { label: name, items };
});

const data = {
  groups,
  help: 'One row per fruit: the card on the deck now, any earlier version, then the new sketches. Heart the one you want on the deck.',
};
const title = `Pick one of each — ${types.length} fruits, ${sketches.length} new sketches`;

if (DRY) {
  console.log(JSON.stringify(data, null, 1).slice(0, 3000));
  console.log(`${groups.length} groups · ${groups.reduce((n, g) => n + g.items.length, 0)} tiles`);
  return;
}
(async () => {
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title, template: 'grid', sheet: SHEET, data }),
  });
  console.log(JSON.stringify(await r.json(), null, 1));
  if (SUPERSEDE) {
    const s = await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' });
    console.log('superseded', SUPERSEDE, s.status);
  }
})();
