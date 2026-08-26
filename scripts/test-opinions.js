// test-opinions.js — the Opinions module, pure, no network.
// Pins: the committed seed is well-formed (unique permanent ids, both sides,
// image sides point at COMMITTED files under public/), the accolade ladder is
// monotonic, mergeFeed lets the committed seed win over a colliding extra, and
// cleanItem content-addresses an id-less item deterministically.
// Run: node scripts/test-opinions.js

const fs = require('fs');
const path = require('path');
const { accoladeFor, mergeFeed, validItem, cleanItem, ACCOLADES, CATEGORIES } =
  require(path.join(__dirname, '..', 'opinions.js'));

let failed = 0;
function ok(cond, name) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── the seed ──────────────────────────────────────────────────────────── */
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'opinions-feed.json'), 'utf8'));
const items = seed.items || [];
ok(items.length >= 20, `seed has a real deck (${items.length} items)`);

const ids = new Set();
let dupes = 0, invalid = 0, missingFiles = [];
for (const it of items) {
  if (ids.has(it.id)) dupes++;
  ids.add(it.id);
  const why = validItem(it);
  if (why) { invalid++; console.log('      invalid ' + (it && it.id) + ': ' + why); }
  for (const s of ['a', 'b']) {
    const img = it[s] && it[s].img;
    // Committed files must exist; a permanent Storage url (her picked draws)
    // is taken on faith — it was verified live when it was filed.
    if (img && !/^https:\/\//.test(img)
      && !fs.existsSync(path.join(__dirname, '..', 'public', img.replace(/^\//, '')))) {
      missingFiles.push(it.id + '.' + s + ' → ' + img);
    }
  }
}
ok(dupes === 0, 'every id unique');
ok(invalid === 0, 'every item valid');
ok(missingFiles.length === 0, 'every image side points at a committed file'
  + (missingFiles.length ? ' — missing: ' + missingFiles.join(', ') : ''));
ok(items.every(it => CATEGORIES.includes(it.category)), 'every category known');

/* ── the modes ─────────────────────────────────────────────────────────── */
const easy = items.filter(it => it.mode === 'easy');
const hard = items.filter(it => it.mode === 'hard');
const feed = items.filter(it => !it.mode);
ok(easy.length >= 5, `easy mode has a real deck (${easy.length})`);
ok(hard.length >= 5, `hard mode has a real deck (${hard.length})`);
ok(feed.length >= 20, `the plain feed still has a real deck (${feed.length})`);
ok(easy.every(it => it.right === 'a' || it.right === 'b'), 'every easy item names its right answer');
ok(hard.every(it => !it.right), 'no hard item claims a right answer');
ok(hard.every(it => it.a.info && it.b.info), 'every hard side carries a more-information line');
ok(items.filter(it => it.verb === 'shoot').length >= 3, 'the gun appears');

/* ── the pairs: every easy scenario names a hard twin, bijectively ─────── */
const byId = new Map(items.map(it => [it.id, it]));
ok(easy.every(it => it.twin && byId.has(it.twin) && byId.get(it.twin).mode === 'hard'),
  'every easy card names an existing hard twin');
const claimed = new Set(easy.map(it => it.twin));
ok(claimed.size === easy.length, 'no two easy cards share a twin');
ok(hard.every(it => claimed.has(it.id)), "every hard card is some easy card's twin");
ok(validItem({ kind: 'text', category: 'wild', mode: 'hard', twin: 'x', a: { t: 'x' }, b: { t: 'y' } }) !== null,
  'a twin on a hard item is refused');
ok(validItem({ kind: 'text', category: 'wild', mode: 'hard', right: 'a', a: { t: 'x' }, b: { t: 'y' } }) !== null,
  'a right answer outside easy mode is refused');
ok(validItem({ kind: 'text', category: 'wild', mode: 'weird', a: { t: 'x' }, b: { t: 'y' } }) !== null,
  'an unknown mode is refused');
ok(validItem({ kind: 'text', category: 'wild', verb: 'stab', a: { t: 'x' }, b: { t: 'y' } }) !== null,
  'an unknown verb is refused');
const cleaned = cleanItem({ kind: 'text', category: 'wild', mode: 'hard', verb: 'shoot', q: 'Q',
  a: { t: 'L', info: 'the dog is mean' }, b: { t: 'R', info: 'so is the cat' } });
ok(cleaned.mode === 'hard' && cleaned.verb === 'shoot' && cleaned.a.info === 'the dog is mean',
  'cleanItem keeps mode, verb and info');

/* ── the accolade ladder ───────────────────────────────────────────────── */
ok(accoladeFor(0) === null, 'no accolade before the first pick');
ok(accoladeFor(1) && accoladeFor(1).name === 'Opinion Haver', 'first pick earns Opinion Haver');
let monotonic = true;
for (let i = 1; i < ACCOLADES.length; i++) {
  if (ACCOLADES[i].n <= ACCOLADES[i - 1].n) monotonic = false;
}
ok(monotonic, 'ladder thresholds strictly increase');
ok(accoladeFor(1000).name === ACCOLADES[ACCOLADES.length - 1].name, 'past the top rung stays at the top rung');

/* ── mergeFeed: committed wins, extras dedupe ──────────────────────────── */
const s1 = [{ id: 'a1' }, { id: 'a2' }];
const merged = mergeFeed(s1, [{ id: 'a2', shadow: true }, { id: 'x1' }, { id: 'x1' }]);
ok(merged.length === 3, 'colliding + duplicate extras dropped');
ok(!merged.find(m => m.shadow), 'a Firestore extra never shadows a committed item');
ok(merged[0].id === 'a1' && merged[2].id === 'x1', 'seed order first, extras after');

/* ── cleanItem: content-addressed id, deterministic ────────────────────── */
const raw = { kind: 'text', category: 'wild', q: 'Q?', a: { t: 'Left' }, b: { t: 'Right' } };
const c1 = cleanItem(raw), c2 = cleanItem(raw);
ok(c1.id === c2.id && /^op-[0-9a-f]{10}$/.test(c1.id), 'id-less item gets a stable content-addressed id');
ok(cleanItem({ ...raw, id: 'My Id!' }).id === 'my-id', 'given ids are slugged');
ok(validItem({ kind: 'image', category: 'look', a: { t: 'A' }, b: { t: 'B', img: '/x.webp' } }) !== null,
  'image item missing a side img is refused');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
