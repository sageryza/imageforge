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
// v3 carries the cherimoya redrawn cut-open (it read as an artichoke whole)
// plus mulberries and kumquat, the two Sophie asked for.
// hq- carries the ones re-rendered at HIGH quality for their own sake, not to
// fix anything — Sophie picking favourites she wants drawn better.
// hq2- is the same idea run through the VEGETABLES' two-up template: six of the
// most-loved fruits, two to a 1536x1024 sheet and cut back into squares, which
// is what makes high affordable (~17c a fruit against 25c drawn singly).
// hq3- carries raspberries redrawn two-up (its hq- single was the first high
// card ever made, before the template existed) with kiwi and fig new to high,
// plus THE MANGO CUT OPEN — Sophie asked for the cherimoya's composition on it,
// a whole fruit standing behind and slices in front, so the two of them read as
// a pair on the chart.
const SOURCES = ['fruit-chart/uploaded.json', 'fruit-chart/v2-uploaded.json',
  'fruit-chart/v3-uploaded.json', 'fruit-chart/hq-uploaded.json',
  'fruit-chart/hq2-uploaded.json', 'fruit-chart/hq3-uploaded.json'];
// v2 is the same 28 vegetables RECUT at the gutter rather than the midpoint —
// the even split put a fragment of the neighbour in some cards and knocked the
// subject off-centre (see the note in fruit-cut.js).
// v3 re-trims every card ignoring isolated specks: one stray tick was
// stretching the box, so the subject sat off-centre and small inside its square
// (Sophie spotted it on the beet and the radish).
// v4 drops the trim padding from 2 mask pixels to 1 — 2 was double the
// quantisation error and stacked on top of the 10% frame, so every card carried
// margin nobody asked for.
const VEG_SOURCES = ['fruit-chart/veg-uploaded.json', 'fruit-chart/veg-v2-uploaded.json',
  'fruit-chart/veg-v3-uploaded.json', 'fruit-chart/veg-v4-uploaded.json'];

// `next` sends them straight from one deck into the other when they finish
// (Sophie: "there could be a button to take the vegetables quiz"). It names the
// POLL, not a url — the same person holds a different token in each one.
const POLLS = {
  // Sophie is IN the family chart — she filled both decks herself. Her answers
  // first landed on the test polls, which are separate, so they were missing
  // from the fridge chart entirely until she was added here.
  'fridge-fruit': { title: 'Favorite fruit', next: { poll: 'fridge-veg', label: 'Now the vegetables' }, people: [{ name: 'Sandy' }, { name: 'Susan' }, { name: 'Steve' }, { name: 'Sophie' }] },
  'fruit-test': { title: 'Favorite fruit (test)', next: { poll: 'veg-test', label: 'Now the vegetables' }, people: [{ name: 'Sophie' }] },
  'fridge-veg': { title: 'Favorite vegetable', deck: 'veg', people: [{ name: 'Sandy' }, { name: 'Susan' }, { name: 'Steve' }, { name: 'Sophie' }] },
  'veg-test': { title: 'Favorite vegetable (test)', deck: 'veg', people: [{ name: 'Sophie' }] },
};

function build(sources) {
  const byId = new Map();
  for (const src of sources) {
    for (const f of JSON.parse(fs.readFileSync(path.join(__dirname, src), 'utf8'))) {
      byId.set(f.id, { id: f.id, name: f.name, url: f.url });
    }
  }
  for (const id of RETIRED) byId.delete(id);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
const DECKS = { fruit: build(SOURCES), veg: build(VEG_SOURCES) };

const want = flag('poll');
const targets = want ? [want] : Object.keys(POLLS);

console.log(`${DECKS.fruit.length} fruits · ${DECKS.veg.length} vegetables · retired: ${[...RETIRED].join(', ') || 'none'}`);
if (DRY) {
  for (const [k, v] of Object.entries(DECKS)) console.log(`\n${k}: ` + v.map(f => f.name).join(', '));
  process.exit(0);
}

(async () => {
  for (const id of targets) {
    const cfg = POLLS[id];
    if (!cfg) { console.error(`unknown poll "${id}"`); continue; }
    const r = await fetch(`${BASE}/api/fruit/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, title: cfg.title, fruits: DECKS[cfg.deck || 'fruit'],
        people: cfg.people, next: cfg.next || null,
      }),
    });
    const d = await r.json();
    console.log(`  ${id} → ${d.fruits} fruits · ${(d.people || []).map(p => p.name + ' ' + p.id).join(', ')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
