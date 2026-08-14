#!/usr/bin/env node
/*
 * test-asset-hash-union.js — the Assets tab joins one picture onto ONE tile.
 *
 * The bug this pins: a picture filed twice — once as its storage object (with
 * the label and the prompt) and once as the `claude-deliveries/<random>` copy
 * the server makes when the same image is also sent as a chat FILE — showed as
 * TWO tiles, the second unlabeled, because the union could only join copies by
 * filename and a random name can never match. The fail-safe is joining on
 * CONTENT (asset-union.js), and this is what says it works.
 *
 * Everything here runs the REAL union — the same function GET /api/gallery/
 * assets calls, driven with fixture records instead of Firestore. No network,
 * no credential, nothing paid.
 *
 *     node scripts/test-asset-hash-union.js
 */
'use strict';

const assert = require('assert');
const { unionAssets, assetRecord, creationRecord, joinKeys, filenameKey } = require('../asset-union');
const { storageRef } = require('../asset-hash');
const { classifyAsset } = require('./sweep-asset-captions.js');

const DECK = 'https://storage.googleapis.com/deckfactory-43176.firebasestorage.app';
const MEMBRY = 'https://storage.googleapis.com/membry-df528.firebasestorage.app';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

/** The route's own shape: records in, tiles out, newest first. */
const tiles = (records) => unionAssets(records).sort((a, b) => b.ms - a.ms);

/* ── 1. two filenames, one md5: they collapse, and the LABEL wins ───────── */
t('two filenames sharing an md5 collapse onto the labeled tile', () => {
  const labeled = assetRecord({
    chat: 'portraits',
    url: `${DECK}/nde-styles/pastel/09-gabe.png`,
    description: 'Gabe in the column of light',
    prompt: 'gpt-image-2 · medium',
    promptStyle: 'style ref: sage-sandy-mirror.png',
    promptContent: 'a boy in a column of light',
    created: '2026-08-14T10:00:00.000Z',
    md5: 'aaaa1111',
  });
  // The hook's auto-filed copy of the SAME bytes: new random filename, no
  // label, no caption — exactly what showed up as a second tile.
  const twin = assetRecord({
    chat: 'portraits',
    url: `${MEMBRY}/claude-deliveries/1755100000000-7f3e9a.png`,
    prompt: 'from portraits',
    created: '2026-08-14T10:00:05.000Z',
    md5: 'aaaa1111',
  });

  const out = tiles([labeled, twin]);
  assert.strictEqual(out.length, 1, 'one picture is one tile');
  assert.strictEqual(out[0].url, labeled.url, 'the url carrying the label is the one kept');
  assert.strictEqual(out[0].description, 'Gabe in the column of light');
  assert.strictEqual(out[0].prompt, 'gpt-image-2 · medium', 'the curated caption beats "from <chat>"');
  assert.strictEqual(out[0].promptStyle, 'style ref: sage-sandy-mirror.png');
  assert.deepStrictEqual(out[0].alts, [twin.url], 'the loser rides along as an alt');
});

t('order does not matter — the unlabeled copy first still keeps the label', () => {
  const twin = assetRecord({
    url: `${MEMBRY}/claude-deliveries/1755100000000-7f3e9a.png`,
    prompt: 'from portraits', created: '2026-08-14T10:00:05.000Z', md5: 'aaaa1111',
  });
  const labeled = assetRecord({
    url: `${DECK}/nde-styles/pastel/09-gabe.png`, description: 'Gabe in the column of light',
    prompt: 'gpt-image-2 · medium', created: '2026-08-14T10:00:00.000Z', md5: 'aaaa1111',
  });
  const out = tiles([twin, labeled]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].url, labeled.url, 'the tile swaps onto the labeled copy');
  assert.strictEqual(out[0].description, 'Gabe in the column of light');
  // The swap leaves the tile's own url in `alts` as well — long-standing
  // behaviour of the filename union (the live route really answers rows whose
  // alts contain their own url), kept declaration for declaration. What
  // matters is that the OTHER path is reachable, for the ♥/note lookup.
  assert.ok(out[0].alts.includes(twin.url), 'the other path is still reachable');
});

t('different md5s are different pictures, whatever else they share', () => {
  const a = assetRecord({ url: `${DECK}/a/v1.png`, md5: 'aaaa1111', created: '2026-08-14T10:00:00.000Z' });
  const b = assetRecord({ url: `${DECK}/b/v2.png`, md5: 'bbbb2222', created: '2026-08-14T10:00:01.000Z' });
  assert.strictEqual(tiles([a, b]).length, 2);
});

/* ── 2. hash-less records behave EXACTLY as they did before ─────────────── */
t('records with no hash still union by filename, unchanged', () => {
  const gen = assetRecord({
    url: `${DECK}/witch-school/assets/lesson-04.png`,
    description: 'Lesson 4 — the moon card', created: '2026-08-10T09:00:00.000Z',
  });
  const copy = assetRecord({
    url: `${MEMBRY}/claude-deliveries/lesson-04.png`,     // same NAME, the old road
    prompt: 'from witch-school', created: '2026-08-10T09:00:02.000Z',
  });
  const out = tiles([gen, copy]);
  assert.strictEqual(out.length, 1, 'the filename union still joins them');
  assert.strictEqual(out[0].description, 'Lesson 4 — the moon card');
  assert.deepStrictEqual(out[0].alts, [copy.url]);
});

t('hash-less records under different filenames stay apart, as before', () => {
  const a = assetRecord({ url: `${DECK}/x/one.png`, created: '2026-08-10T09:00:00.000Z' });
  const b = assetRecord({ url: `${DECK}/y/two.png`, created: '2026-08-10T09:00:01.000Z' });
  assert.strictEqual(tiles([a, b]).length, 2);
});

t('a malformed %-escape in a url never aborts the union', () => {
  // A literal "%s.webp" template string really has been filed as an image, and
  // decodeURIComponent throws on it — the whole tab used to come back empty.
  const bad = assetRecord({ url: `${DECK}/tmp/%s.webp`, created: '2026-08-01T00:00:00.000Z' });
  const good = assetRecord({ url: `${DECK}/tmp/real.png`, created: '2026-08-01T00:00:01.000Z' });
  assert.strictEqual(tiles([bad, good]).length, 2);
  assert.strictEqual(filenameKey(`${DECK}/tmp/%s.webp`), '%s.webp');
});

/* ── 3. the CHAIN: A~md5~B, B~filename~C — one tile, not two ────────────── */
t('a chain of joins collapses the whole group (md5 ↔ filename ↔ sha256)', () => {
  // A: the labeled original.
  const a = assetRecord({
    url: `${DECK}/art/portrait.png`, description: 'The portrait',
    created: '2026-08-14T12:00:00.000Z', md5: 'cccc3333',
  });
  // B: shares A's md5 (same bytes) under a delivery name; also carries the
  //    sha256 POST /api/gallery computed when the bytes arrived inline.
  const b = assetRecord({
    url: `${MEMBRY}/claude-deliveries/1755-abc.png`, prompt: 'from art',
    created: '2026-08-14T12:00:01.000Z', md5: 'cccc3333', hash: 'sha-of-the-bytes',
  });
  // C: shares only B's sha256 — no md5 on file, a different filename again.
  const c = assetRecord({
    url: `${DECK}/other/copy-again.png`, promptContent: 'a woman reading',
    created: '2026-08-14T12:00:02.000Z', hash: 'sha-of-the-bytes',
  });
  const out = tiles([a, b, c]);
  assert.strictEqual(out.length, 1, 'A–B–C is one picture, so it is one tile');
  assert.strictEqual(out[0].url, a.url, 'still the labeled url');
  assert.strictEqual(out[0].promptContent, 'a woman reading', 'C\'s prompt half survives the merge');
  assert.strictEqual(out[0].alts.length, 2, 'both other paths ride along');
  assert.ok(out[0].alts.includes(b.url) && out[0].alts.includes(c.url));
});

t('the chain collapses whatever order the records arrive in', () => {
  const mk = () => [
    assetRecord({ url: `${DECK}/other/copy-again.png`, hash: 'sha1', created: '2026-08-14T12:00:02.000Z' }),
    assetRecord({ url: `${DECK}/art/portrait.png`, description: 'The portrait', md5: 'm1', created: '2026-08-14T12:00:00.000Z' }),
    assetRecord({ url: `${MEMBRY}/claude-deliveries/x.png`, md5: 'm1', hash: 'sha1', created: '2026-08-14T12:00:01.000Z' }),
  ];
  const [c, a, b] = mk();
  [[a, b, c], [c, b, a], [b, a, c], [c, a, b]].forEach((order) => {
    const out = tiles(order);
    assert.strictEqual(out.length, 1, 'one tile in every arrival order');
    assert.strictEqual(out[0].description, 'The portrait', 'the label survives every order');
  });
});

t('an md5 is never compared against a sha256', () => {
  // Two hashes of the SAME bytes by different algorithms are different strings;
  // sharing a namespace would have silently failed to group and, worse, looked
  // like it worked. Namespaced keys make that impossible.
  const keys = joinKeys({ url: `${DECK}/a/b.png`, md5: 'ff00', hash: 'ff00' });
  assert.deepStrictEqual(keys, ['m:ff00', 's:ff00', 'f:b.png']);
  const a = assetRecord({ url: `${DECK}/a/one.png`, md5: 'ff00', created: '2026-08-14T00:00:00.000Z' });
  const b = assetRecord({ url: `${DECK}/a/two.png`, hash: 'ff00', created: '2026-08-14T00:00:01.000Z' });
  assert.strictEqual(tiles([a, b]).length, 2, 'same string, different algorithms: not a match');
});

/* ── 4. a ♥ or a note left on EITHER path is still found ────────────────── */
t('a vote left on the twin is found through alts', () => {
  // The route looks a vote up by tile url, then by every alt — so the tile has
  // to carry the other path or her ♥ is lost when the copies merge.
  const labeled = assetRecord({ url: `${DECK}/art/p.png`, description: 'P', md5: 'dddd', created: '2026-08-14T10:00:00.000Z' });
  const twin = assetRecord({ url: `${MEMBRY}/claude-deliveries/9z.png`, md5: 'dddd', created: '2026-08-14T10:00:01.000Z' });
  const tile = tiles([labeled, twin])[0];

  const votes = new Map([[twin.url, { vote: 'like', note: 'this one' }]]);
  let v = votes.get(tile.url);
  if (!v) for (const u of tile.alts) { const alt = votes.get(u); if (alt) { v = alt; break; } }
  assert.ok(v, 'the ♥ left on the other path is reachable');
  assert.strictEqual(v.vote, 'like');
  assert.strictEqual(v.note, 'this one');
});

/* ── 5. the sweep stops counting a merged twin as a stray ───────────────── */
t('after the union the twin is no longer a claude-deliveries stray', () => {
  const labeled = assetRecord({
    url: `${DECK}/art/p.png`, description: 'P', prompt: 'gpt-image-2 · medium',
    promptContent: 'a portrait', md5: 'eeee', created: '2026-08-14T10:00:00.000Z',
  });
  const twin = assetRecord({
    url: `${MEMBRY}/claude-deliveries/1755-zz.png`, prompt: 'from art',
    md5: 'eeee', created: '2026-08-14T10:00:01.000Z',
  });

  // Before: two rows, the second unlabeled and living in claude-deliveries.
  const apart = [labeled, twin].map((r) => classifyAsset({
    url: r.url, description: r.description, prompt: r.prompt, promptContent: r.promptContent,
  }));
  assert.strictEqual(apart.filter((x) => x.stray).length, 1, 'the un-merged twin WAS a stray');

  // After: one row, labeled, with the delivery path in alts — the sweep reads
  // alts, so it must not report the merged tile as a stray.
  const tile = tiles([labeled, twin])[0];
  const merged = classifyAsset({
    url: tile.url, description: tile.description, prompt: tile.prompt,
    promptContent: tile.promptContent, alts: tile.alts,
  });
  assert.strictEqual(merged.stray, false, 'a merged, labeled tile is not a stray');
  assert.deepStrictEqual(merged.missing, [], 'and it is missing nothing');
});

/* ── 6. the records the route actually builds ───────────────────────────── */
t('assetRecord / creationRecord carry what the union needs', () => {
  const r = assetRecord({
    url: `${DECK}/a/b.png`, created: '2026-08-14T10:00:00.000Z', prompt: 'p',
    description: 'd', promptStyle: 's', promptContent: 'c', kind: '', hash: 'sha', md5: 'md5',
  });
  assert.strictEqual(r.ms, Date.parse('2026-08-14T10:00:00.000Z'));
  assert.strictEqual(r.md5, 'md5');
  assert.strictEqual(r.hash, 'sha');

  // A membry creation carries a Firestore Timestamp and no hash of any kind.
  const c = creationRecord({ url: `${MEMBRY}/x/y.png`, prompt: 'from art', createdAt: { toMillis: () => 1755 } });
  assert.strictEqual(c.ms, 1755);
  assert.strictEqual(c.md5, undefined);

  // A creation and an asset record for the same picture still join by filename.
  const out = tiles([
    creationRecord({ url: `${MEMBRY}/x/y.png`, prompt: 'from art', createdAt: { toMillis: () => 1000 } }),
    assetRecord({ url: `${DECK}/gen/y.png`, description: 'Y', created: '1970-01-01T00:00:02.000Z' }),
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].description, 'Y');
});

t('a record with no url is dropped, and audio is still recognised by its url', () => {
  const out = tiles([
    assetRecord({ url: '', created: '2026-08-14T10:00:00.000Z' }),
    assetRecord({ url: `${DECK}/cut/take-3.mp3`, created: '2026-08-14T10:00:01.000Z' }),
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].kind, 'audio');
});

/* ── 7. the url parser that finds the object to read the md5 from ───────── */
t('storageRef resolves both projects and both url shapes', () => {
  assert.deepStrictEqual(storageRef(`${DECK}/nde-styles/pastel/09.png`),
    { bucket: 'deckfactory-43176.firebasestorage.app', path: 'nde-styles/pastel/09.png' });
  assert.deepStrictEqual(storageRef(`${MEMBRY}/claude-deliveries/1755-ab.png`),
    { bucket: 'membry-df528.firebasestorage.app', path: 'claude-deliveries/1755-ab.png' });
  // The tokened download url the app hands around.
  assert.deepStrictEqual(
    storageRef('https://firebasestorage.googleapis.com/v0/b/membry-df528.firebasestorage.app/o/'
      + 'witch-school%2Frefs%2Fsophie-snake.png?alt=media&token=abc'),
    { bucket: 'membry-df528.firebasestorage.app', path: 'witch-school/refs/sophie-snake.png' });
  assert.deepStrictEqual(storageRef('https://deckfactory-43176.firebasestorage.app.storage.googleapis.com/a/b.png'),
    { bucket: 'deckfactory-43176.firebasestorage.app', path: 'a/b.png' });
  // Anything that is not a Storage object files with no md5, never an error.
  assert.strictEqual(storageRef('https://replicate.delivery/pbxt/xyz/out.png'), null);
  assert.strictEqual(storageRef('not a url'), null);
  assert.strictEqual(storageRef(''), null);
  assert.strictEqual(storageRef('https://storage.googleapis.com/onlybucket'), null);
});

console.log(`\n  ${n} checks passed\n`);
