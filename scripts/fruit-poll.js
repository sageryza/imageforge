// fruit-poll.js — build the deck from the uploaded records and post the poll.
//
//   node scripts/fruit-poll.js [--poll fridge-fruit] [--dry]
//
// The deck is assembled here rather than by hand so "which fruits are in it"
// has one answer that survives a redraw: later records WIN, which is how the
// nine v2 redraws replaced their grid-cut v1s without the ids changing — and
// keeping the id is what keeps a ballot already cast still valid, and every
// personal link already in an inbox still working.
//
// RETIRED holds fruits that were drawn but are not in the deck. They are kept
// (the pictures stay in the gallery and in Storage) — they are simply not
// asked about.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const BASE = flag('base', 'https://imageforge-q125.onrender.com');
const DRY = args.includes('--dry');

// Sophie's call, Aug 2026: "I would take dragon fruit out just cause we don't
// really eat it in our family."
const RETIRED = new Set(['27-dragonfruit']);

// Oldest first — a later record replaces an earlier one with the same id.
const SOURCES = ['fruit-chart/uploaded.json', 'fruit-chart/v2-uploaded.json'];

const POLLS = {
  'fridge-fruit': { title: 'Favorite fruit', people: [{ name: 'Sandy' }, { name: 'Susan' }, { name: 'Steve' }] },
  'fruit-test': { title: 'Favorite fruit (test)', people: [{ name: 'Sophie' }] },
};

const byId = new Map();
for (const src of SOURCES) {
  for (const f of JSON.parse(fs.readFileSync(path.join(__dirname, src), 'utf8'))) {
    byId.set(f.id, { id: f.id, name: f.name, url: f.url });
  }
}
for (const id of RETIRED) byId.delete(id);
const fruits = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

const want = flag('poll');
const targets = want ? [want] : Object.keys(POLLS);

console.log(`${fruits.length} fruits · retired: ${[...RETIRED].join(', ') || 'none'}`);
if (DRY) { console.log(fruits.map(f => f.name).join(', ')); process.exit(0); }

(async () => {
  for (const id of targets) {
    const cfg = POLLS[id];
    if (!cfg) { console.error(`unknown poll "${id}"`); continue; }
    const r = await fetch(`${BASE}/api/fruit/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: cfg.title, fruits, people: cfg.people }),
    });
    const d = await r.json();
    console.log(`  ${id} → ${d.fruits} fruits · ${(d.people || []).map(p => p.name + ' ' + p.id).join(', ')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
