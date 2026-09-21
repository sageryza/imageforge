// fruit-sketch-pick.js — one row per fruit, every version of it side by side,
// so Sophie can heart ONE of each (2026-09-20, Sophie, after sending six 2x2
// sheets of fruit sketches: "cut these up and match so i can pick just one of
// each type").
//
//   node scripts/fruit-sketch-pick.js [--chat fruits-vegetables-inventory] [--dry]
//                                     [--supersede <pageId>] [--carry <pageId>]
//
// AN ✕ TAKES THE PICTURE OFF THE CARD, INTO THE NO PILE (2026-09-20, Sophie,
// on the first version: "if i x one it should disappear to the no pile") —
// `spreadEach` + `spreadAll` (judge.js): every version of a fruit is one swipe
// card, each picture wears its own ✕/♥, and a no leaves the card so the rest
// can be compared. The page opens on SWIPE for that reason (start:'swipe';
// the compare grid is still behind the switch). `--carry <pageId>` copies her
// marks off the page it replaces (same item ids; a spread pick `s:<fruit>`
// becomes a ♥ on that picture) — needs FIREBASE_SERVICE_ACCOUNT.
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
const CARRY = flag('carry');
// --finished: the cards she has decided (a ♥ on one of the group's pictures)
// come OFF the pick page and go onto a separate FINISHED page, one picture
// each (2026-09-20, Sophie: "take the ones i finished off · make them a
// separate finished deck"). Reads the marks off the --carry page; the pick
// page keeps only the undecided cards, still carrying their marks.
const FINISHED = args.includes('--finished');
// --reopen a,b: cards that go BACK on the pick page whatever their marks —
// she hearted the deck pomegranate before the high one was on the page
// (2026-09-20), so the card is reopened with every version on it.
const REOPEN = new Set((flag('reopen', '') || '').split(',').filter(Boolean));
// --auto-single: a card with ONE picture and no mark counts as picked
// (2026-09-21, Sophie, looking at 26 lone cards among the 33 left: "auto pick
// the single ones"). An ✕ on a lone picture still keeps it on the pick page —
// that is her "draw me another". The auto-picks are written as ♥ on the new
// pick page's marks so the next rebuild keeps them finished.
const AUTO_SINGLE = args.includes('--auto-single');
const autoPicked = [];
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

// EVERY FRUIT AND EVERY VEGETABLE IS ON THE PAGE (2026-09-20, Sophie: "find
// all my fruits and vegetables" · "where r veggie") — the 37 fruits off the
// deck and the 28 vegetables off theirs, one card each; a fruit with new
// sketches is a card of several pictures, the rest are one picture to keep or
// not. The vegetables' earlier versions are the same drawing re-cut (v1-v3),
// so only the card on the deck rides.
// THE QUALITY-LADDER TESTS ARE VERSIONS TOO (2026-09-20, Sophie: "are u sure
// that pomegranate is medium not high · was there other pomegranates") —
// fruit/qtest holds strawberry, pomegranate and broccoli drawn at low, medium
// and high for the ladder page; the deck's pomegranate is the ORIGINAL medium.
// They ride as earlier versions on their cards.
const QTEST = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app/fruit/qtest/';
for (const [id, name] of [['19-pomegranate', 'pomegranate'], ['01-strawberry', 'strawberry']]) {
  for (const q of ['high', 'medium', 'low']) add(id, { url: `${QTEST}q-${name}-${q}.webp`, full: `${QTEST}q-${name}-${q}.webp`, name }, q + ' (quality test)');
}
// REDRAWS FROM HER NOTES ride as versions too (fruit-redraw.js appends to
// redo-uploaded.json; 2026-09-20 — the cut-open pairs, asparagus and
// broccoli on their own at 2K).
const redos = fs.existsSync(path.join(__dirname, 'fruit-chart', 'redo-uploaded.json')) ? read('redo-uploaded.json') : [];
const redoItems = deckId => redos.filter(r => r.deck === deckId).map(r => ({ id: r.id, img: r.url, full: r.full, url: r.full,
  label: `redrawn · ${r.tag === 'cut1' ? 'whole + cut open' : r.tag === 'few1' ? 'a few' : 'on its own'} · ${r.quality} · ${r.size || '1K'}`, model: 'gpt-image-2', quality: r.quality, size: r.size || '1K' }));
const vegPoll = read('poll-veg-test.json'); // GET /api/fruit/poll/veg-test, saved 2026-09-20
const fruitGroups = poll.fruits.map(f => {
  const id = f.id, name = f.name;
  const olds = [...(existing.get(id) || new Map()).values()];
  if (!olds.some(o => o.url === deckUrl.get(id))) olds.push({ url: f.url, full: f.url.replace('/card/', '/full/'), quality: 'medium' });
  const now = olds.filter(o => o.url === deckUrl.get(id));
  const prior = olds.filter(o => o.url !== deckUrl.get(id));
  const items = [
    ...now.map(o => ({ id: `${id}--deck`, img: o.url, full: o.full, url: o.full,
      label: `on the deck now · ${o.quality} · 1K`, model: 'gpt-image-2', quality: o.quality, size: '1K' })),
    ...prior.map((o, i) => ({ id: `${id}--prior${i + 1}`, img: o.url, full: o.full, url: o.full,
      label: `earlier version · ${o.quality} · 1K`, model: 'gpt-image-2', quality: o.quality, size: '1K' })),
    ...sketches.filter(s => s.deck === id).map(s => ({ id: s.id, img: s.url, full: s.full, url: s.full,
      label: `new · sheet ${s.sheet}` })),
    ...redoItems(id),
  ];
  return { label: name, items };
});
// THE 38TH FRUIT: dragon fruit was RETIRED off the deck (fruit-compare-page.js)
// but its card is still in Storage — it rides last so "all my fruit" is all of
// it (2026-09-20, Sophie: "r u sure that's all the fruit"). Measured that day:
// fruit/card holds 38 deck ids and nothing else fruit-shaped lives in any chat.
const retired = read('uploaded.json').filter(f => !deckUrl.has(f.id)).map(f => ({ label: f.name, items: [{
  id: `${f.id}--retired`, img: f.url, full: f.full, url: f.full,
  label: 'retired from the deck · medium', model: 'gpt-image-2', quality: 'medium' }] }));
fruitGroups.push(...retired);
const vegGroups = vegPoll.fruits.map(v => ({ label: v.name, items: [{
  id: `${v.id}--vdeck`, img: v.url, full: v.url, url: v.url,
  label: 'on the vegetable deck now · medium · 1K sheet ÷ 2', model: 'gpt-image-2', quality: 'medium', size: '1K' },
  ...(v.id === '02-broccoli' ? ['high', 'medium', 'low'].map(q => ({ id: `${v.id}--q${q}`, img: `${QTEST}q-broccoli-${q}.webp`, full: `${QTEST}q-broccoli-${q}.webp`, url: `${QTEST}q-broccoli-${q}.webp`,
    label: `earlier version · ${q} · 1K (quality test)`, model: 'gpt-image-2', quality: q, size: '1K' })) : []),
  ...redoItems(v.id)] }));
const groups = [...fruitGroups, ...vegGroups];
const types = fruitGroups.length;

const data = {
  groups, spreadEach: true, spreadAll: true, start: 'swipe',
  help: 'One card per fruit and per vegetable: the version on the deck now, any earlier one, then the new sketches. Heart the one you want on the deck; an ✕ takes a picture off the card into the No pile.',
};
let finishedGroups = [];
async function splitFinished() {
  const r = await fetch(`${BASE}/api/chatfeed/verdict?chat=${CHAT}&sheet=page-${CARRY}`);
  const marks = (await r.json()).items || {};
  const keep = [];
  for (const g of groups) {
    const picked = g.items.filter(it => marks[it.id] === true);
    const reopened = g.items.some(it => REOPEN.has(it.id.split('--')[0].replace(/-sk\d$/, '')));
    if (picked.length && !reopened) finishedGroups.push({ label: g.label, items: picked.map(it => ({ ...it, label: it.label })) });
    else if (AUTO_SINGLE && !reopened && g.items.length === 1 && marks[g.items[0].id] !== false) {
      finishedGroups.push({ label: g.label, items: [{ ...g.items[0] }] });
      autoPicked.push(g.items[0].id);
    }
    else keep.push(g);
  }
  groups.length = 0; groups.push(...keep);
}
const title = `Pick one of each — ${fruitGroups.length} fruits, ${vegGroups.length} vegetables, ${sketches.length} new sketches`;

if (DRY) {
  console.log(JSON.stringify(data, null, 1).slice(0, 3000));
  console.log(`${groups.length} groups · ${groups.reduce((n, g) => n + g.items.length, 0)} tiles`);
  return;
}
(async () => {
  if (FINISHED && CARRY) {
    await splitFinished();
    const fr = await fetch(`${BASE}/api/chatfeed/page`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: CHAT, title: `Finished — ${finishedGroups.length} picked`, template: 'grid',
        data: { groups: finishedGroups, help: 'The one you picked for each fruit. Heart or ✕ here still counts.' } }),
    });
    console.log('finished page', JSON.stringify(await fr.json()));
    const OLD_FINISHED = flag('supersede-finished');
    if (OLD_FINISHED) console.log('superseded finished', OLD_FINISHED, (await fetch(`${BASE}/api/chatfeed/page/${OLD_FINISHED}/supersede`, { method: 'POST' })).status);
  }
  const left = groups.length;
  const r = await fetch(`${BASE}/api/chatfeed/page`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: CHAT, title: FINISHED ? `Pick one of each — ${left} left` : title, template: 'grid', sheet: SHEET, data }),
  });
  const posted = await r.json();
  console.log(JSON.stringify(posted, null, 1));
  if (CARRY && posted.id) {
    const admin = require('firebase-admin');
    const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(key) });
    const db = admin.firestore();
    const old = (await db.collection('forge-chat-verdicts').doc(`${CHAT}__page-${CARRY}`).get()).data() || {};
    const items = {};
    for (const [k, v] of Object.entries(old.items || {})) if (!k.startsWith('s:') && v != null) items[k] = v;
    // a spread pick on the old page ("this one") is a heart on that picture now
    for (const [k, v] of Object.entries(old.items || {})) {
      if (k.startsWith('s:') && typeof v === 'string' && v !== 'maybe' && items[v] == null) items[v] = true;
    }
    for (const id of autoPicked) if (items[id] == null) items[id] = true;
    const patch = { items };
    if (old.texts) patch.texts = old.texts;
    await db.collection('forge-chat-verdicts').doc(`${CHAT}__page-${posted.id}`).set(patch, { merge: true });
    console.log(`carried ${Object.keys(items).length} marks from ${CARRY}` + (autoPicked.length ? ` (+${autoPicked.length} auto-picked singles)` : ''));
  }
  if (SUPERSEDE) {
    const s = await fetch(`${BASE}/api/chatfeed/page/${SUPERSEDE}/supersede`, { method: 'POST' });
    console.log('superseded', SUPERSEDE, s.status);
  }
})();
